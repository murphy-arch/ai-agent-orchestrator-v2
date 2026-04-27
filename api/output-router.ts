import { z } from "zod";
import { eq, and, desc, like, sql } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { agentOutputs, aiAgents } from "@db/schema";

export const outputRouter = router({
  // ─── List all outputs in a stack ───
  list: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number().optional(),
        source: z.string().optional(),
        search: z.string().optional(),
        contentType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const conditions = [eq(agentOutputs.stackId, input.stackId), eq(agentOutputs.isArchived, false)];
      if (input.agentId !== undefined) conditions.push(eq(agentOutputs.agentId, input.agentId));
      if (input.source) conditions.push(eq(agentOutputs.source, input.source));
      if (input.contentType) conditions.push(eq(agentOutputs.contentType, input.contentType));

      let query = db
        .select()
        .from(agentOutputs)
        .where(and(...conditions))
        .orderBy(desc(agentOutputs.createdAt));

      const rows = await query;

      if (input.search && input.search.trim()) {
        const term = input.search.trim().toLowerCase();
        return rows.filter(
          (r) =>
            r.name.toLowerCase().includes(term) ||
            (r.description ?? "").toLowerCase().includes(term) ||
            r.content.toLowerCase().includes(term)
        );
      }

      return rows;
    }),

  // ─── Get a single output by ID ───
  getById: authedQuery
    .input(z.object({ stackId: z.number(), id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [row] = await db
        .select()
        .from(agentOutputs)
        .where(and(eq(agentOutputs.id, input.id), eq(agentOutputs.stackId, input.stackId)))
        .limit(1);

      return row ?? null;
    }),

  // ─── Create an output ───
  create: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number().optional(),
        workflowRunId: z.number().optional(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        contentType: z.string().optional(),
        content: z.string(),
        mimeType: z.string().optional(),
        tags: z.array(z.string()).optional(),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const { stackId, ...data } = input;
      const [result] = await db.insert(agentOutputs).values({
        ...data,
        stackId,
        sizeBytes: Buffer.byteLength(data.content, "utf8"),
      });

      return { id: Number(result.insertId) };
    }),

  // ─── Update an output ───
  update: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        tags: z.array(z.string()).optional(),
        isArchived: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const { stackId, id, ...updates } = input;
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.content !== undefined) {
        updateData.content = updates.content;
        updateData.sizeBytes = Buffer.byteLength(updates.content, "utf8");
      }
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.isArchived !== undefined) updateData.isArchived = updates.isArchived;

      await db
        .update(agentOutputs)
        .set(updateData)
        .where(and(eq(agentOutputs.id, id), eq(agentOutputs.stackId, stackId)));

      return { success: true };
    }),

  // ─── Delete an output ───
  delete: authedQuery
    .input(z.object({ stackId: z.number(), id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      await db
        .delete(agentOutputs)
        .where(and(eq(agentOutputs.id, input.id), eq(agentOutputs.stackId, input.stackId)));

      return { success: true };
    }),

  // ─── Stats for the database page ───
  stats: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const rows = await db
        .select({ count: sql<number>`count(*)`, totalSize: sql<number>`coalesce(sum(size_bytes),0)` })
        .from(agentOutputs)
        .where(and(eq(agentOutputs.stackId, input.stackId), eq(agentOutputs.isArchived, false)));

      const byType = await db
        .select({ contentType: agentOutputs.contentType, count: sql<number>`count(*)` })
        .from(agentOutputs)
        .where(and(eq(agentOutputs.stackId, input.stackId), eq(agentOutputs.isArchived, false)))
        .groupBy(agentOutputs.contentType);

      return {
        totalCount: rows[0]?.count ?? 0,
        totalSizeBytes: rows[0]?.totalSize ?? 0,
        byType,
      };
    }),
});
