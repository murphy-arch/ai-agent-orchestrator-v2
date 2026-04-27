import { z } from "zod";
import { eq, and, desc, like } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { memories } from "@db/schema";

export const memoryRouter = router({
  // ─── List memories for a stack ───
  list: authedQuery
    .input(z.object({ stackId: z.number(), userId: z.number().optional(), category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const conditions = [eq(memories.stackId, input.stackId), eq(memories.isActive, true)];
      if (input.userId !== undefined) {
        conditions.push(eq(memories.userId, input.userId));
      }
      if (input.category) {
        conditions.push(eq(memories.category, input.category));
      }

      const rows = await db
        .select()
        .from(memories)
        .where(and(...conditions))
        .orderBy(desc(memories.updatedAt));

      return rows;
    }),

  // ─── Create or update a memory ───
  upsert: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        userId: z.number().optional(),
        key: z.string().min(1),
        value: z.string().min(1),
        category: z.string().default("general"),
        confidence: z.number().min(0).max(100).default(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      // Check if memory with same key exists
      const existing = await db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.stackId, input.stackId),
            eq(memories.key, input.key),
            input.userId !== undefined ? eq(memories.userId, input.userId) : undefined
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(memories)
          .set({
            value: input.value,
            category: input.category,
            confidence: input.confidence,
          })
          .where(eq(memories.id, existing[0].id));
        return { ...existing[0], value: input.value, category: input.category, confidence: input.confidence };
      }

      const [result] = await db.insert(memories).values({
        stackId: input.stackId,
        userId: input.userId ?? null,
        key: input.key,
        value: input.value,
        category: input.category,
        confidence: input.confidence,
      });

      return {
        id: Number(result.insertId),
        stackId: input.stackId,
        userId: input.userId ?? null,
        key: input.key,
        value: input.value,
        category: input.category,
        confidence: input.confidence,
      };
    }),

  // ─── Delete a memory ───
  delete: authedQuery
    .input(z.object({ stackId: z.number(), memoryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);
      await db.delete(memories).where(eq(memories.id, input.memoryId));
      return { success: true };
    }),

  // ─── Search memories ───
  search: authedQuery
    .input(z.object({ stackId: z.number(), query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const rows = await db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.stackId, input.stackId),
            eq(memories.isActive, true),
            like(memories.value, `%${input.query}%`)
          )
        )
        .orderBy(desc(memories.confidence))
        .limit(20);

      return rows;
    }),
});
