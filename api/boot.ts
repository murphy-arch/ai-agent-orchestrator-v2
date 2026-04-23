import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { readFileSync } from "fs";
import "dotenv/config";
import { appRouter } from "./_app";
import { createContext } from "./middleware";
import { migrateToMultiStack } from "./migrations/001-default-stack";
import { addClient, removeClient, broadcastLog } from "./lib/log-broadcaster";
import { getDb } from "@db/connection";
import { eq } from "drizzle-orm";
import { inputSources } from "@db/schema";
import { dispatchOutput } from "./lib/dispatch-output";

function createApp() {
  const app = new Hono();

  // CORS for tRPC
  app.use(
    "/trpc/*",
    cors({
      origin: ["http://localhost:5173", "http://localhost:3000", "https://olympus-ollama-cd.tail218dac.ts.net"],
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization", "x-jwt"],
    })
  );

  // CORS for API routes
  app.use(
    "/api/*",
    cors({
      origin: ["http://localhost:5173", "http://localhost:3000", "https://olympus-ollama-cd.tail218dac.ts.net"],
      credentials: true,
    })
  );

  // tRPC handler
  app.use("/trpc/*", async (c) => {
    return fetchRequestHandler({
      router: appRouter,
      req: c.req.raw,
      endpoint: "/trpc",
      createContext: () => createContext(c),
    });
  });

  // ─── Health Check (with DB test) ───
  app.get("/health", async (c) => {
    try {
      const db = getDb();
      await db.execute("SELECT 1");
      return c.json({ status: "healthy", db: "connected", version: "2.0.0", ts: Date.now() });
    } catch {
      return c.json({ status: "degraded", db: "disconnected", version: "2.0.0", ts: Date.now() }, 503);
    }
  });

  // Also support /api/health for backward compatibility
  app.get("/api/health", async (c) => {
    try {
      const db = getDb();
      await db.execute("SELECT 1");
      return c.json({ status: "healthy", db: "connected", version: "2.0.0", ts: Date.now() });
    } catch {
      return c.json({ status: "degraded", db: "disconnected", version: "2.0.0", ts: Date.now() }, 503);
    }
  });

  // ─── SSE Live Log Stream ───
  app.get("/api/logs/stream", async (c) => {
    const agentIdParam = c.req.query("agentId");
    const agentId = agentIdParam ? Number(agentIdParam) : undefined;

    const stream = new ReadableStream({
      start(controller) {
        const id = addClient(controller, agentId);
        controller.enqueue(`data: ${JSON.stringify({ type: "connected", clientId: id })}\n\n`);
      },
      cancel(controller) {
        // Find and remove client by controller reference
        // The log-broadcaster doesn't index by controller, so we rely on cleanup in broadcastLog
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });

  // ─── Generic Webhook Receiver ───
  app.post("/api/webhook/:sourceType/:sourceId", async (c) => {
    const sourceType = c.req.param("sourceType");
    const sourceId = Number(c.req.param("sourceId"));
    const payload = await c.req.json().catch(() => ({}));

    const db = getDb();
    const [source] = await db
      .select()
      .from(inputSources)
      .where(eq(inputSources.id, sourceId))
      .limit(1);

    if (!source) {
      return c.json({ success: false, error: "Source not found" }, 404);
    }

    // Log the webhook receipt
    broadcastLog({
      agentId: source.targetAgentId ?? 0,
      eventType: "webhook",
      message: `Webhook received from ${sourceType} (${source.name})`,
      metadata: JSON.stringify({ sourceId, sourceType, payloadSize: JSON.stringify(payload).length }),
    });

    return c.json({ success: true, stackId: source.stackId, message: "Webhook received" });
  });

  // ─── Workflow Trigger Webhook ───
  app.post("/api/webhook/trigger/:workflowId", async (c) => {
    const workflowId = c.req.param("workflowId");
    const payload = await c.req.json().catch(() => ({}));

    broadcastLog({
      agentId: 0,
      eventType: "webhook",
      message: `Workflow trigger received for workflow ${workflowId}`,
      metadata: JSON.stringify({ workflowId, payload }),
    });

    return c.json({ success: true, workflowId, message: "Workflow trigger received" });
  });

  // ─── Test Output Endpoint ───
  app.post("/api/webhook/test-output", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { outputType, config } = body as { outputType: string; config: Record<string, string> };

    if (!outputType || !config) {
      return c.json({ success: false, error: "Missing outputType or config" }, 400);
    }

    try {
      const result = await dispatchOutput(outputType, config, "Test message from AI Agent Orchestrator");
      return c.json({ success: true, detail: result.detail || "Test complete" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ success: false, error: message }, 500);
    }
  });

  // ─── Static File Serving (production) ───
  if (process.env.NODE_ENV === "production") {
    app.use("/*", serveStatic({ root: "./dist/public" }));

    // For React Router: serve index.html for all non-API routes
    app.notFound((c) => {
      if (c.req.path.startsWith("/api") || c.req.path.startsWith("/trpc")) {
        return c.json({ error: "Not found" }, 404);
      }
      try {
        return c.html(readFileSync("./dist/public/index.html", "utf-8"));
      } catch {
        return c.text("index.html not found", 500);
      }
    });
  }

  return app;
}

async function boot() {
  console.log("[boot] Starting AI Agent Orchestrator v2.0.0...");

  // Validate JWT secret
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === "change-me-in-production") {
    console.warn("[boot] WARNING: JWT_SECRET is not set or uses default value. Auth tokens are insecure!");
  }

  // Validate encryption key
  const encKey = process.env.ENCRYPTION_KEY || process.env.APP_SECRET;
  if (!encKey) {
    console.warn("[boot] WARNING: ENCRYPTION_KEY or APP_SECRET is not set. API keys cannot be encrypted!");
  }

  // Run migrations
  await migrateToMultiStack();

  const app = createApp();
  const port = Number(process.env.PORT) || 3000;

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`[boot] Server running on http://localhost:${port}`);
  console.log(`[boot] tRPC endpoint: http://localhost:${port}/trpc`);
  console.log(`[boot] Health check: http://localhost:${port}/health`);
}

boot().catch((err) => {
  console.error("[boot] Fatal error:", err);
  process.exit(1);
});
