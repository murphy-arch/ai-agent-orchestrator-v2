import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { aiAgents } from "@db/schema";

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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const { stackId, ...agentData } = input;

      const [result] = await db.insert(aiAgents).values({
        ...agentData,
        stackId,
        createdBy: ctx.user.id,
      });

      const agentId = Number(result.insertId);

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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.systemPrompt !== undefined) updateData.systemPrompt = input.systemPrompt;
      if (input.hierarchyRole !== undefined) updateData.hierarchyRole = input.hierarchyRole;
      if (input.modelProvider !== undefined) updateData.modelProvider = input.modelProvider;
      if (input.modelName !== undefined) updateData.modelName = input.modelName;
      if (input.temperature !== undefined) updateData.temperature = input.temperature;
      if (input.maxTokens !== undefined) updateData.maxTokens = input.maxTokens;
      if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update",
        });
      }

      await db
        .update(aiAgents)
        .set(updateData)
        .where(
          and(
            eq(aiAgents.id, input.agentId),
            eq(aiAgents.stackId, input.stackId)
          )
        );

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
});
