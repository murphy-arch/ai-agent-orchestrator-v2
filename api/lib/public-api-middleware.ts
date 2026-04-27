import { Context, Next } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@db/connection";
import { publicApiKeys } from "@db/schema";
import { verifyPassword } from "./crypto";

// ─── In-Memory Rate Limit Store ───
// keyId -> { windowStart: number, count: number }
const rateLimitStore = new Map<number, { windowStart: number; count: number }>();

const RATE_WINDOW_MS = 60_000; // 1 minute

export interface PublicApiContext {
  keyId: number;
  stackId: number;
  permissions: string[];
}

// ─── Validate API Key ───
export async function validatePublicApiKey(c: Context): Promise<PublicApiContext | null> {
  const apiKey = c.req.header("x-api-key");
  if (!apiKey) return null;

  // Expect format: ask_xxxxxxxxxxxxxxxx (prefix + 16+ chars)
  const prefix = apiKey.slice(0, 16); // first 16 chars as prefix for lookup
  const db = getDb();

  // Try to find by prefix (we store first 12 chars, so truncate further)
  const storedPrefix = prefix.slice(0, 12);

  const [row] = await db
    .select()
    .from(publicApiKeys)
    .where(
      and(
        eq(publicApiKeys.keyPrefix, storedPrefix),
        eq(publicApiKeys.isActive, true)
      )
    )
    .limit(1);

  if (!row) return null;

  // Verify bcrypt hash
  const valid = await verifyPassword(apiKey, row.keyHash);
  if (!valid) return null;

  return {
    keyId: row.id,
    stackId: row.stackId,
    permissions: (row.permissions as string[]) || ["run", "agents", "chat", "executions"],
  };
}

// ─── Rate Limit Check ───
export function checkRateLimit(keyId: number, limit: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(keyId);

  if (!record || now - record.windowStart > RATE_WINDOW_MS) {
    // New window
    rateLimitStore.set(keyId, { windowStart: now, count: 1 });
    return { allowed: true, remaining: limit - 1, resetIn: RATE_WINDOW_MS };
  }

  if (record.count >= limit) {
    const resetIn = RATE_WINDOW_MS - (now - record.windowStart);
    return { allowed: false, remaining: 0, resetIn };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetIn: RATE_WINDOW_MS - (now - record.windowStart) };
}

// ─── Update Key Usage Stats ───
export async function recordApiUsage(keyId: number) {
  const db = getDb();
  await db
    .update(publicApiKeys)
    .set({
      lastUsedAt: new Date(),
      requestCount: sql`${publicApiKeys.requestCount} + 1`,
    })
    .where(eq(publicApiKeys.id, keyId));
}

// ─── Hono Middleware Factory ───
export function publicApiMiddleware(requiredPermission: string) {
  return async (c: Context, next: Next) => {
    const auth = await validatePublicApiKey(c);
    if (!auth) {
      return c.json({ error: "Invalid or missing API key" }, 401);
    }

    // Check permission
    if (!auth.permissions.includes(requiredPermission) && !auth.permissions.includes("*")) {
      return c.json({ error: `Permission '${requiredPermission}' required` }, 403);
    }

    // Rate limit
    const db = getDb();
    const [keyRow] = await db
      .select({ rateLimit: publicApiKeys.rateLimit })
      .from(publicApiKeys)
      .where(eq(publicApiKeys.id, auth.keyId))
      .limit(1);

    const limit = keyRow?.rateLimit ?? 60;
    const rl = checkRateLimit(auth.keyId, limit);
    if (!rl.allowed) {
      c.header("X-RateLimit-Limit", String(limit));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(Math.ceil(rl.resetIn / 1000)));
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(rl.remaining));

    // Record usage (fire and forget)
    recordApiUsage(auth.keyId).catch(() => {});

    // Attach to context
    c.set("publicApi", auth);
    await next();
  };
}
