import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { apiKeys, users } from "@db/schema";

export const settingsRouter = router({
  // ─── Get stack settings (API keys, etc.) ───
  getStackSettings: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const keys = await db
        .select({
          id: apiKeys.id,
          stackId: apiKeys.stackId,
          provider: apiKeys.provider,
          keyLabel: apiKeys.keyLabel,
          keyValue: apiKeys.keyValue,
          isActive: apiKeys.isActive,
          createdAt: apiKeys.createdAt,
          updatedAt: apiKeys.updatedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.stackId, input.stackId));

      return { apiKeys: keys };
    }),

  // ─── Add an API key to a stack ───
  addApiKey: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        provider: z.string().min(1),
        keyLabel: z.string().min(1),
        keyValue: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [result] = await db.insert(apiKeys).values({
        stackId: input.stackId,
        provider: input.provider,
        keyLabel: input.keyLabel,
        keyValue: input.keyValue,
      });

      return { id: Number(result.insertId) };
    }),

  // ─── Delete an API key ───
  deleteApiKey: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        keyId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      await db
        .delete(apiKeys)
        .where(
          and(eq(apiKeys.id, input.keyId), eq(apiKeys.stackId, input.stackId))
        );

      return { success: true };
    }),

  // ─── Update current user's profile ───
  updateUserProfile: authedQuery
    .input(
      z.object({
        name: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;

      if (Object.keys(updateData).length === 0) {
        return { success: true };
      }

      await db.update(users).set(updateData).where(eq(users.id, ctx.user.id));

      return { success: true };
    }),
});
