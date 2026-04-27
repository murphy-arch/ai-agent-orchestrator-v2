import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { publicApiKeys } from "@db/schema";
import { hashPassword } from "./lib/crypto";
import { randomBytes } from "crypto";

function generateApiKey(): string {
  return "ask_" + randomBytes(24).toString("hex");
}

export const publicApiKeyRouter = router({
  // ─── List public API keys for a stack ───
  list: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const rows = await db
        .select({
          id: publicApiKeys.id,
          stackId: publicApiKeys.stackId,
          name: publicApiKeys.name,
          keyPrefix: publicApiKeys.keyPrefix,
          permissions: publicApiKeys.permissions,
          rateLimit: publicApiKeys.rateLimit,
          lastUsedAt: publicApiKeys.lastUsedAt,
          requestCount: publicApiKeys.requestCount,
          isActive: publicApiKeys.isActive,
          createdAt: publicApiKeys.createdAt,
        })
        .from(publicApiKeys)
        .where(eq(publicApiKeys.stackId, input.stackId))
        .orderBy(desc(publicApiKeys.createdAt));

      return rows;
    }),

  // ─── Create a new public API key ───
  create: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        name: z.string().min(1).max(255),
        permissions: z.array(z.string()).optional(),
        rateLimit: z.number().min(1).max(10000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const plainKey = generateApiKey();
      const keyHash = await hashPassword(plainKey);
      const keyPrefix = plainKey.slice(0, 12);

      const [result] = await db.insert(publicApiKeys).values({
        stackId: input.stackId,
        name: input.name,
        keyHash,
        keyPrefix,
        permissions: input.permissions ?? ["run", "agents", "chat", "executions"],
        rateLimit: input.rateLimit ?? 60,
        isActive: true,
      });

      return {
        id: Number(result.insertId),
        plainKey,
        name: input.name,
        keyPrefix,
      };
    }),

  // ─── Update a public API key ───
  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        permissions: z.array(z.string()).optional(),
        rateLimit: z.number().min(1).max(10000).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [existing] = await db
        .select()
        .from(publicApiKeys)
        .where(eq(publicApiKeys.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }

      await verifyStackAccess(ctx.user.id, existing.stackId);

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.permissions !== undefined) updateData.permissions = input.permissions;
      if (input.rateLimit !== undefined) updateData.rateLimit = input.rateLimit;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      if (Object.keys(updateData).length > 0) {
        await db
          .update(publicApiKeys)
          .set(updateData)
          .where(eq(publicApiKeys.id, input.id));
      }

      return { success: true };
    }),

  // ─── Delete a public API key ───
  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [existing] = await db
        .select()
        .from(publicApiKeys)
        .where(eq(publicApiKeys.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }

      await verifyStackAccess(ctx.user.id, existing.stackId);

      await db
        .update(publicApiKeys)
        .set({ isActive: false })
        .where(eq(publicApiKeys.id, input.id));

      return { success: true };
    }),
});
