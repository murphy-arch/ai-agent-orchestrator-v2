import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, authedQuery, publicQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { apiKeys, users, masterPassword } from "@db/schema";
import { encrypt, decrypt, hashPassword, verifyPassword } from "./lib/crypto";
import { TRPCError } from "@trpc/server";

export const settingsRouter = router({
  // ─── Get stack settings (API keys without values) ───
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
          isActive: apiKeys.isActive,
          createdAt: apiKeys.createdAt,
          updatedAt: apiKeys.updatedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.stackId, input.stackId));

      return { apiKeys: keys };
    }),

  // ─── Add an API key to a stack (encrypts value) ───
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

      const encryptedValue = encrypt(input.keyValue);

      const [result] = await db.insert(apiKeys).values({
        stackId: input.stackId,
        provider: input.provider,
        keyLabel: input.keyLabel,
        keyValue: encryptedValue,
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

  // ─── Master Password: check if set ───
  hasMasterPassword: publicQuery.query(async () => {
    const db = getDb();
    const [mp] = await db.select().from(masterPassword);
    return { set: !!mp };
  }),

  // ─── Master Password: set or change ───
  setMasterPassword: authedQuery
    .input(z.object({ password: z.string().min(4) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.select().from(masterPassword);
      const hashed = await hashPassword(input.password);

      if (existing.length > 0) {
        await db
          .update(masterPassword)
          .set({ passwordHash: hashed })
          .where(eq(masterPassword.id, existing[0].id));
      } else {
        await db.insert(masterPassword).values({ passwordHash: hashed });
      }
      return { success: true };
    }),

  // ─── Master Password: verify ───
  verifyMasterPassword: publicQuery
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [mp] = await db.select().from(masterPassword);
      if (!mp) return { valid: false, error: "Master password not set" };

      const valid = await verifyPassword(input.password, mp.passwordHash);
      if (!valid) return { valid: false, error: "Invalid master password" };

      return { valid: true };
    }),

  // ─── List API keys with decrypted values (requires master password) ───
  listApiKeysDecrypted: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        masterPassword: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      // Verify master password
      const [mp] = await db.select().from(masterPassword);
      if (!mp) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Master password not set",
        });
      }
      const valid = await verifyPassword(input.masterPassword, mp.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid master password",
        });
      }

      const keys = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.stackId, input.stackId))
        .orderBy(apiKeys.createdAt);

      return keys.map((k) => ({
        ...k,
        keyValue: k.keyValue ? decrypt(k.keyValue) : "",
      }));
    }),

  // ─── Get single API key value (requires master password) ───
  getApiKeyValue: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        keyId: z.number(),
        masterPassword: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [mp] = await db.select().from(masterPassword);
      if (!mp) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Master password not set",
        });
      }
      const valid = await verifyPassword(input.masterPassword, mp.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid master password",
        });
      }

      const [key] = await db
        .select()
        .from(apiKeys)
        .where(
          and(eq(apiKeys.id, input.keyId), eq(apiKeys.stackId, input.stackId))
        )
        .limit(1);

      if (!key) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Key not found" });
      }

      return { value: key.keyValue ? decrypt(key.keyValue) : "" };
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
