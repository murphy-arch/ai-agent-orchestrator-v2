import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { agentApiCredentials, aiAgents, apiKeys } from "@db/schema";
import { decrypt } from "./lib/crypto";

async function testProviderConnection(
  credentialType: string,
  apiKey: string,
  model?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const provider = credentialType.toLowerCase();
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return { ok: false, error: `OpenAI error: ${res.status}` };
      return { ok: true };
    }
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      if (!res.ok) return { ok: false, error: `Anthropic error: ${res.status}` };
      return { ok: true };
    }
    if (provider === "google" || provider === "google ai") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (!res.ok) return { ok: false, error: `Google AI error: ${res.status}` };
      return { ok: true };
    }
    if (provider === "elevenlabs") {
      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) return { ok: false, error: `ElevenLabs error: ${res.status}` };
      return { ok: true };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export const agentCredentialsRouter = createRouter({
  list: publicQuery
    .input(z.object({ agentId: z.number() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.agentId) {
        return db
          .select()
          .from(agentApiCredentials)
          .where(eq(agentApiCredentials.agentId, input.agentId));
      }
      return db.select().from(agentApiCredentials);
    }),

  create: publicQuery
    .input(
      z.object({
        agentId: z.number(),
        credentialType: z.string().min(1),
        apiKeyId: z.number().optional(),
        endpointOverride: z.string().optional(),
        modelOverride: z.string().optional(),
        additionalConfig: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(agentApiCredentials).values({
        ...input,
        apiKeyId: input.apiKeyId ?? null,
        endpointOverride: input.endpointOverride ?? null,
        modelOverride: input.modelOverride ?? null,
        additionalConfig: input.additionalConfig ?? null,
      });
      const insertId = Number(result[0].insertId);
      const [cred] = await db
        .select()
        .from(agentApiCredentials)
        .where(eq(agentApiCredentials.id, insertId));
      return cred;
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        credentialType: z.string().optional(),
        apiKeyId: z.number().optional(),
        endpointOverride: z.string().optional(),
        modelOverride: z.string().optional(),
        additionalConfig: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(agentApiCredentials).set(data).where(eq(agentApiCredentials.id, id));
      const [cred] = await db
        .select()
        .from(agentApiCredentials)
        .where(eq(agentApiCredentials.id, id));
      return cred;
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(agentApiCredentials).where(eq(agentApiCredentials.id, input.id));
      return { success: true };
    }),

  testConnection: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [cred] = await db
        .select()
        .from(agentApiCredentials)
        .where(eq(agentApiCredentials.id, input.id));
      if (!cred) return { ok: false, error: "Credential not found" };
      if (!cred.apiKeyId) return { ok: false, error: "No API key linked" };

      const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, cred.apiKeyId));
      if (!key) return { ok: false, error: "Linked API key not found" };

      const apiKey = decrypt(key.keyValue);
      return testProviderConnection(cred.credentialType, apiKey, cred.modelOverride || undefined);
    }),
});
