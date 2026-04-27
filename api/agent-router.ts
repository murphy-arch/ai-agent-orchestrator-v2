import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { aiAgents, agentCredentials, apiKeys, masterPassword, soulTemplates, agentSouls } from "@db/schema";
import { decrypt } from "./lib/crypto";
import { testProviderConnection } from "./lib/llm-provider";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const agentRouter = router({
  // ─── List all agents in a stack ───
  list: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const agents = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.stackId, input.stackId))
        .orderBy(desc(aiAgents.createdAt));

      return agents;
    }),

  // ─── Get a single agent by ID ───
  getById: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [agent] = await db
        .select()
        .from(aiAgents)
        .where(
          and(
            eq(aiAgents.id, input.agentId),
            eq(aiAgents.stackId, input.stackId)
          )
        )
        .limit(1);

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      return agent;
    }),

  // ─── Create a new agent ───
  create: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        systemPrompt: z.string().optional(),
        hierarchyRole: z.string().optional(),
        modelProvider: z.string().optional(),
        modelName: z.string().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        apiKeyId: z.number().optional(),
        soulTemplateId: z.number().optional(),
        agentFunctionId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const { stackId, apiKeyId, soulTemplateId, agentFunctionId, ...agentData } = input;
      const slug = slugify(agentData.name);
      const agentType = agentData.hierarchyRole ?? "worker";

      // Personalize system prompt with agent name if function template was used
      const systemPrompt = agentData.systemPrompt?.replace(
        /\{\{AGENT_NAME\}\}/g,
        agentData.name
      );

      const [result] = await db.insert(aiAgents).values({
        ...agentData,
        systemPrompt,
        slug,
        agentType,
        functionId: agentFunctionId ?? null,
        stackId,
        createdBy: ctx.user.id,
      });

      const agentId = Number(result.insertId);

      // Link API key if provided
      if (apiKeyId) {
        const [key] = await db
          .select()
          .from(apiKeys)
          .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.stackId, stackId)))
          .limit(1);
        if (key) {
          await db.insert(agentCredentials).values({
            agentId,
            credentialType: key.provider,
            apiKeyId: key.id,
            isActive: true,
          });
        }
      }

      // Create personalized soul copy if template selected
      if (soulTemplateId) {
        const [template] = await db
          .select()
          .from(soulTemplates)
          .where(eq(soulTemplates.id, soulTemplateId))
          .limit(1);
        if (template) {
          const personalizedContent = template.content.replace(
            /\{\{AGENT_NAME\}\}/g,
            agentData.name
          );
          await db.insert(agentSouls).values({
            agentId,
            templateId: template.id,
            name: `${template.name} (${agentData.name})`,
            content: personalizedContent,
            isActive: true,
          });
        }
      }

      return { id: agentId };
    }),

  // ─── Update an agent ───
  update: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        systemPrompt: z.string().optional(),
        hierarchyRole: z.string().optional(),
        modelProvider: z.string().optional(),
        modelName: z.string().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        isEnabled: z.boolean().optional(),
        apiKeyId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const { stackId, agentId, apiKeyId, ...agentData } = input;

      const updateData: Record<string, unknown> = {};
      if (agentData.name !== undefined) updateData.name = agentData.name;
      if (agentData.description !== undefined) updateData.description = agentData.description;
      if (agentData.systemPrompt !== undefined) updateData.systemPrompt = agentData.systemPrompt;
      if (agentData.hierarchyRole !== undefined) updateData.hierarchyRole = agentData.hierarchyRole;
      if (agentData.modelProvider !== undefined) updateData.modelProvider = agentData.modelProvider;
      if (agentData.modelName !== undefined) updateData.modelName = agentData.modelName;
      if (agentData.temperature !== undefined) updateData.temperature = agentData.temperature;
      if (agentData.maxTokens !== undefined) updateData.maxTokens = agentData.maxTokens;
      if (agentData.isEnabled !== undefined) updateData.isEnabled = agentData.isEnabled;

      if (Object.keys(updateData).length > 0) {
        await db
          .update(aiAgents)
          .set(updateData)
          .where(
            and(
              eq(aiAgents.id, agentId),
              eq(aiAgents.stackId, stackId)
            )
          );
      }

      // Update credential link if apiKeyId provided
      if (apiKeyId !== undefined) {
        if (apiKeyId === null || apiKeyId === 0) {
          // Remove credential
          await db
            .delete(agentCredentials)
            .where(eq(agentCredentials.agentId, agentId));
        } else {
          const [key] = await db
            .select()
            .from(apiKeys)
            .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.stackId, stackId)))
            .limit(1);
          if (key) {
            const [existing] = await db
              .select()
              .from(agentCredentials)
              .where(eq(agentCredentials.agentId, agentId))
              .limit(1);
            if (existing) {
              await db
                .update(agentCredentials)
                .set({
                  credentialType: key.provider,
                  apiKeyId: key.id,
                  isActive: true,
                })
                .where(eq(agentCredentials.id, existing.id));
            } else {
              await db.insert(agentCredentials).values({
                agentId,
                credentialType: key.provider,
                apiKeyId: key.id,
                isActive: true,
              });
            }
          }
        }
      }

      return { success: true };
    }),

  // ─── Delete an agent ───
  delete: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      // Verify agent belongs to this stack before deleting anything
      const [agent] = await db
        .select({ id: aiAgents.id })
        .from(aiAgents)
        .where(and(eq(aiAgents.id, input.agentId), eq(aiAgents.stackId, input.stackId)))
        .limit(1);
      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found in this stack" });
      }

      // Delete credentials first
      await db
        .delete(agentCredentials)
        .where(eq(agentCredentials.agentId, input.agentId));

      // Delete agent's personalized soul copy
      await db
        .delete(agentSouls)
        .where(eq(agentSouls.agentId, input.agentId));

      await db
        .delete(aiAgents)
        .where(
          and(
            eq(aiAgents.id, input.agentId),
            eq(aiAgents.stackId, input.stackId)
          )
        );

      return { success: true };
    }),

  // ─── Get agent soul ───
  getSoul: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [soul] = await db
        .select()
        .from(agentSouls)
        .where(eq(agentSouls.agentId, input.agentId))
        .limit(1);

      return soul ?? null;
    }),

  // ─── Get agent credential ───
  getCredential: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [cred] = await db
        .select()
        .from(agentCredentials)
        .where(eq(agentCredentials.agentId, input.agentId))
        .limit(1);

      if (!cred) return null;

      const [key] = await db
        .select({
          id: apiKeys.id,
          provider: apiKeys.provider,
          keyLabel: apiKeys.keyLabel,
        })
        .from(apiKeys)
        .where(eq(apiKeys.id, cred.apiKeyId ?? 0))
        .limit(1);

      return { ...cred, apiKey: key ?? null };
    }),

  // ─── Test agent credential connection ───
  testCredential: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number(),
        masterPassword: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [cred] = await db
        .select()
        .from(agentCredentials)
        .where(eq(agentCredentials.agentId, input.agentId))
        .limit(1);

      if (!cred) return { ok: false, error: "No credential linked" };
      if (!cred.apiKeyId) return { ok: false, error: "No API key linked" };

      const [mp] = await db.select().from(masterPassword);
      if (!mp) return { ok: false, error: "Master password not set" };

      const { verifyPassword } = await import("./lib/crypto");
      const valid = await verifyPassword(input.masterPassword, mp.passwordHash);
      if (!valid) return { ok: false, error: "Invalid master password" };

      const [key] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, cred.apiKeyId))
        .limit(1);

      if (!key) return { ok: false, error: "Linked API key not found" };

      const apiKey = decrypt(key.keyValue);
      return testProviderConnection(cred.credentialType, apiKey, cred.modelOverride || undefined);
    }),
});
