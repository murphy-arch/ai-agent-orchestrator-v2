import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import {
  workflowTemplates,
  workflowNodes,
  workflowEdges,
  aiAgents,
  agentSouls,
  soulTemplates,
  apiKeys,
  agentCredentials,
} from "@db/schema";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function resolveApiKeyForStack(stackId: number) {
  const db = getDb();
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.stackId, stackId), eq(apiKeys.isActive, true)))
    .limit(1);
  return key ?? null;
}

async function createAgentFromSpec(opts: {
  stackId: number;
  userId: number;
  spec: {
    name: string;
    description?: string;
    systemPrompt?: string;
    hierarchyRole?: string;
    modelProvider?: string;
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
    functionId?: number | null;
    soulTemplateId?: number | null;
  };
}) {
  const db = getDb();
  const { stackId, userId, spec } = opts;

  const name = spec.name;
  const slug = slugify(name);
  const agentType = spec.hierarchyRole ?? "worker";
  const systemPrompt = (spec.systemPrompt || "")
    .replace(/\{\{AGENT_NAME\}\}/g, name);

  const [result] = await db.insert(aiAgents).values({
    stackId,
    name,
    description: spec.description ?? null,
    systemPrompt: systemPrompt || null,
    hierarchyRole: spec.hierarchyRole ?? "worker",
    modelProvider: spec.modelProvider ?? "openai",
    modelName: spec.modelName ?? "gpt-4o",
    temperature: spec.temperature ?? 70,
    maxTokens: spec.maxTokens ?? 2048,
    functionId: spec.functionId ?? null,
    slug,
    agentType,
    isEnabled: true,
    createdBy: userId,
  });

  const agentId = Number(result.insertId);

  // Auto-link first available API key so the agent is runnable
  const apiKey = await resolveApiKeyForStack(stackId);
  if (apiKey) {
    await db.insert(agentCredentials).values({
      agentId,
      credentialType: apiKey.provider,
      apiKeyId: apiKey.id,
      isActive: true,
    });
  }

  // Create personalized soul if soul template specified
  if (spec.soulTemplateId) {
    const [soulTemplate] = await db
      .select()
      .from(soulTemplates)
      .where(eq(soulTemplates.id, spec.soulTemplateId))
      .limit(1);

    if (soulTemplate) {
      const personalized = (soulTemplate.content || "").replace(
        /\{\{AGENT_NAME\}\}/g,
        name
      );
      await db.insert(agentSouls).values({
        agentId,
        templateId: soulTemplate.id,
        name: `${soulTemplate.name} (${name})`,
        content: personalized,
        isActive: true,
      });
    }
  }

  return agentId;
}

export const templateRouter = router({
  // ─── List templates ───
  list: authedQuery
    .input(z.object({ category: z.string().optional() }))
    .query(async () => {
      const db = getDb();

      const rows = await db
        .select()
        .from(workflowTemplates)
        .where(and(eq(workflowTemplates.isActive, true), eq(workflowTemplates.isPublic, true)))
        .orderBy(desc(workflowTemplates.usageCount));

      return rows;
    }),

  // ─── Get a single template ───
  getById: authedQuery
    .input(z.object({ templateId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.id, input.templateId))
        .limit(1);

      if (!row) throw new Error("Template not found");
      return row;
    }),

  // ─── Apply a template to a stack ───
  use: authedQuery
    .input(z.object({ stackId: z.number(), templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [template] = await db
        .select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.id, input.templateId))
        .limit(1);

      if (!template) throw new Error("Template not found");

      // Soft-delete existing workflow
      await db
        .update(workflowNodes)
        .set({ isActive: false })
        .where(eq(workflowNodes.stackId, input.stackId));
      await db
        .update(workflowEdges)
        .set({ isActive: false })
        .where(eq(workflowEdges.stackId, input.stackId));

      // Parse template nodes/edges
      const templateNodes = (template.nodes as Array<{
        id?: number;
        agentId?: number | null;
        type: string;
        positionX?: number;
        positionY?: number;
        data?: Record<string, unknown> & { agentSpec?: Record<string, unknown> };
      }>) || [];

      const templateEdges = (template.edges as Array<{
        id?: number;
        sourceId: number;
        targetId: number;
        condition?: string | null;
      }>) || [];

      // Create agents from embedded specs and build ID map
      const idMap = new Map<number, number>();
      const createdAgentIds: number[] = [];

      for (let i = 0; i < templateNodes.length; i++) {
        const n = templateNodes[i];
        let agentId: number | null = n.agentId ?? null;

        // If node has an embedded agent spec, create the agent
        if (n.data?.agentSpec && (n.type === "agent" || n.type === "orchestrator")) {
          const spec = n.data.agentSpec as {
            name: string;
            description?: string;
            systemPrompt?: string;
            hierarchyRole?: string;
            modelProvider?: string;
            modelName?: string;
            temperature?: number;
            maxTokens?: number;
            functionId?: number | null;
            soulTemplateId?: number | null;
          };
          agentId = await createAgentFromSpec({
            stackId: input.stackId,
            userId: ctx.user.id,
            spec,
          });
          createdAgentIds.push(agentId);
        }

        // Strip agentSpec from node data before saving (it's only for template instantiation)
        const nodeData = { ...n.data };
        delete (nodeData as any).agentSpec;

        const [result] = await db.insert(workflowNodes).values({
          stackId: input.stackId,
          agentId,
          type: n.type,
          positionX: n.positionX ?? 0,
          positionY: n.positionY ?? 0,
          data: nodeData,
          isActive: true,
        });
        const newId = Number(result.insertId);
        idMap.set(n.id ?? i + 1, newId);
      }

      for (const e of templateEdges) {
        const sourceNum = idMap.get(e.sourceId) ?? e.sourceId;
        const targetNum = idMap.get(e.targetId) ?? e.targetId;
        await db.insert(workflowEdges).values({
          stackId: input.stackId,
          sourceId: sourceNum,
          targetId: targetNum,
          condition: e.condition ?? null,
          isActive: true,
        });
      }

      // Increment usage count
      await db
        .update(workflowTemplates)
        .set({ usageCount: (template.usageCount ?? 0) + 1 })
        .where(eq(workflowTemplates.id, input.templateId));

      return {
        success: true,
        nodesInserted: templateNodes.length,
        edgesInserted: templateEdges.length,
        agentsCreated: createdAgentIds.length,
      };
    }),

  // ─── Create a template from current workflow (save as template) ───
  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z.string().default("general"),
        nodes: z.array(z.record(z.any())),
        edges: z.array(z.record(z.any())),
        isPublic: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [result] = await db.insert(workflowTemplates).values({
        name: input.name,
        description: input.description,
        category: input.category,
        nodes: input.nodes as any,
        edges: input.edges as any,
        isPublic: input.isPublic,
        createdBy: ctx.user.id,
      });

      return { id: Number(result.insertId), ...input };
    }),

  // ─── Delete a template ───
  delete: authedQuery
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verify user is creator or admin
      const [template] = await db
        .select({ createdBy: workflowTemplates.createdBy })
        .from(workflowTemplates)
        .where(eq(workflowTemplates.id, input.templateId))
        .limit(1);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      if (template.createdBy !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the creator or admin can delete this template" });
      }

      await db
        .update(workflowTemplates)
        .set({ isActive: false })
        .where(eq(workflowTemplates.id, input.templateId));

      return { success: true };
    }),
});
