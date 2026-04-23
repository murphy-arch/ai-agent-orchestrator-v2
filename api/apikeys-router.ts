import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { apiKeys, masterPassword } from "@db/schema";
import {
  hashPassword,
  verifyPassword,
  encrypt,
  decrypt,
} from "./lib/crypto";

export const apiKeysRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const keys = await db
      .select({
        id: apiKeys.id,
        serviceName: apiKeys.serviceName,
        keyLabel: apiKeys.keyLabel,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
      })
      .from(apiKeys)
      .orderBy(desc(apiKeys.createdAt));
    return keys;
  }),

  // Returns decrypted key values only when master password is verified
  listWithValues: publicQuery
    .input(z.object({ masterPassword: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();

      const [mp] = await db.select().from(masterPassword);
      if (!mp) {
        return {
          error: "Master password not set",
          keys: [] as (typeof apiKeys.$inferSelect & { keyValue: string })[],
        };
      }

      const valid = await verifyPassword(input.masterPassword, mp.passwordHash);
      if (!valid) {
        return {
          error: "Invalid master password",
          keys: [] as (typeof apiKeys.$inferSelect & { keyValue: string })[],
        };
      }

      const keys = await db
        .select()
        .from(apiKeys)
        .orderBy(desc(apiKeys.createdAt));

      // Decrypt key values on the fly
      const decryptedKeys = keys.map((k) => ({
        ...k,
        keyValue: k.keyValue ? decrypt(k.keyValue) : "",
      }));

      return { error: null, keys: decryptedKeys };
    }),

  // Get single key value (decrypted, requires master password)
  getValue: publicQuery
    .input(z.object({ id: z.number(), masterPassword: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();

      const [mp] = await db.select().from(masterPassword);
      if (!mp) return { error: "Master password not set", value: null };

      const valid = await verifyPassword(input.masterPassword, mp.passwordHash);
      if (!valid) return { error: "Invalid master password", value: null };

      const [key] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, input.id));
      if (!key) return { error: "Key not found", value: null };

      return { error: null, value: decrypt(key.keyValue) };
    }),

  hasMasterPassword: publicQuery.query(async () => {
    const db = getDb();
    const [mp] = await db.select().from(masterPassword);
    return { set: !!mp };
  }),

  verifyMasterPassword: publicQuery
    .input(z.object({ password: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [mp] = await db.select().from(masterPassword);
      if (!mp) return { valid: false };
      const valid = await verifyPassword(input.password, mp.passwordHash);
      return { valid };
    }),

  setMasterPassword: publicQuery
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

  changeMasterPassword: publicQuery
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(4),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [mp] = await db.select().from(masterPassword);
      if (!mp) return { success: false, error: "Master password not set" };

      const valid = await verifyPassword(input.currentPassword, mp.passwordHash);
      if (!valid) return { success: false, error: "Current password is incorrect" };

      const hashed = await hashPassword(input.newPassword);
      await db
        .update(masterPassword)
        .set({ passwordHash: hashed })
        .where(eq(masterPassword.id, mp.id));
      return { success: true };
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [key] = await db
        .select({
          id: apiKeys.id,
          serviceName: apiKeys.serviceName,
          keyLabel: apiKeys.keyLabel,
          isActive: apiKeys.isActive,
          createdAt: apiKeys.createdAt,
          updatedAt: apiKeys.updatedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.id, input.id));
      return key ?? null;
    }),

  checkServices: publicQuery.query(async () => {
    const db = getDb();
    const keys = await db
      .select({ serviceName: apiKeys.serviceName, isActive: apiKeys.isActive })
      .from(apiKeys);
    const services = [
      ...new Set(keys.filter((k) => k.isActive).map((k) => k.serviceName)),
    ];
    return { services, totalKeys: keys.length };
  }),

  create: publicQuery
    .input(
      z.object({
        serviceName: z.string().min(1).max(100),
        keyLabel: z.string().min(1).max(255),
        keyValue: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      // Encrypt the API key before storage
      const encryptedValue = encrypt(input.keyValue);
      const result = await db
        .insert(apiKeys)
        .values({
          serviceName: input.serviceName,
          keyLabel: input.keyLabel,
          keyValue: encryptedValue,
        });
      const insertId = Number(result[0].insertId);
      const [key] = await db
        .select({
          id: apiKeys.id,
          serviceName: apiKeys.serviceName,
          keyLabel: apiKeys.keyLabel,
          isActive: apiKeys.isActive,
          createdAt: apiKeys.createdAt,
          updatedAt: apiKeys.updatedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.id, insertId));
      return key;
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        serviceName: z.string().min(1).max(100).optional(),
        keyLabel: z.string().min(1).max(255).optional(),
        keyValue: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;

      // Encrypt new key value if provided
      const updateData: Record<string, unknown> = { ...data };
      if (data.keyValue) {
        updateData.keyValue = encrypt(data.keyValue);
      }

      await db.update(apiKeys).set(updateData).where(eq(apiKeys.id, id));
      const [updated] = await db
        .select({
          id: apiKeys.id,
          serviceName: apiKeys.serviceName,
          keyLabel: apiKeys.keyLabel,
          isActive: apiKeys.isActive,
          createdAt: apiKeys.createdAt,
          updatedAt: apiKeys.updatedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.id, id));
      return updated;
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(apiKeys).where(eq(apiKeys.id, input.id));
      return { success: true };
    }),

  testKey: publicQuery
    .input(z.object({ id: z.number(), masterPassword: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();

      const [mp] = await db.select().from(masterPassword);
      if (!mp) return { ok: false, error: "Master password not set" };

      const valid = await verifyPassword(input.masterPassword, mp.passwordHash);
      if (!valid) return { ok: false, error: "Invalid master password" };

      const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, input.id));
      if (!key) return { ok: false, error: "Key not found" };

      const apiKey = decrypt(key.keyValue);
      const provider = key.serviceName.toLowerCase();

      try {
        if (provider.includes("openai")) {
          const res = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!res.ok) return { ok: false, error: `OpenAI error: ${res.status}` };
          return { ok: true };
        }
        if (provider.includes("anthropic")) {
          const res = await fetch("https://api.anthropic.com/v1/models", {
            headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          });
          if (!res.ok) return { ok: false, error: `Anthropic error: ${res.status}` };
          return { ok: true };
        }
        if (provider.includes("google")) {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          if (!res.ok) return { ok: false, error: `Google AI error: ${res.status}` };
          return { ok: true };
        }
        if (provider.includes("elevenlabs")) {
          const res = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": apiKey },
          });
          if (!res.ok) return { ok: false, error: `ElevenLabs error: ${res.status}` };
          return { ok: true };
        }
        return { ok: true, message: "Validation not available for this provider" };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }),
});
