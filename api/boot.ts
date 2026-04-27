import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import "dotenv/config";
import { appRouter } from "./_app";
import { createContext } from "./middleware";
import { migrateToMultiStack } from "./migrations/001-default-stack";
import { addClient, removeClient, broadcastLog } from "./lib/log-broadcaster";
import { getDb } from "@db/connection";
import { eq, and } from "drizzle-orm";
import { inputSources, workflowNodes, aiAgents, executionRuns } from "@db/schema";
import { dispatchOutput } from "./lib/dispatch-output";
import { runWorkflow } from "./lib/workflow-engine";
import { startScheduler, stopScheduler } from "./lib/scheduler";
import { handleDocumentUpload } from "./document-router";
import { seedTemplates } from "./lib/seed-templates";
import { seedSoulTemplates } from "./lib/seed-souls";
import { seedAgentFunctions } from "./lib/seed-agent-functions";
import { seedSkills } from "./lib/seed-skills";
import { seedBlueprints } from "./lib/seed-blueprints";
import { publicApiMiddleware } from "./lib/public-api-middleware";

function createApp() {
  const app = new Hono();

  // CORS for tRPC
  app.use(
    "/trpc/*",
    cors({
      origin: ["http://localhost:5173", "http://localhost:3000", "https://orchestrator.website", "https://www.orchestrator.website"],
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization", "x-jwt"],
    })
  );

  // CORS for API routes
  app.use(
    "/api/*",
    cors({
      origin: ["http://localhost:5173", "http://localhost:3000", "https://orchestrator.website", "https://www.orchestrator.website"],
      credentials: true,
    })
  );

  // â”€â”€â”€ Rate Limiting â”€â”€â”€
  const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT = 120; // requests per window
  const RATE_WINDOW = 60_000; // 1 minute

  app.use("/trpc/*", async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    } else {
      entry.count++;
      if (entry.count > RATE_LIMIT) {
        return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
      }
    }
    await next();
  });

  app.use("/api/*", async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    } else {
      entry.count++;
      if (entry.count > RATE_LIMIT) {
        return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
      }
    }
    await next();
  });

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

  // ─── Document Upload (multipart) ───
  app.post("/api/upload/:stackId", async (c) => {
    return handleDocumentUpload(c);
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

  // ─── Telegram Webhook Receiver ───
  app.post("/api/webhook/telegram/:stackId", async (c) => {
    const stackId = Number(c.req.param("stackId"));
    const payload = await c.req.json().catch(() => ({}));

    const message = payload.message || payload.edited_message || {};
    const chatId = message.chat?.id;
    const text = message.text || "";

    console.log(`[telegram webhook] stackId=${stackId} chatId=${chatId} text="${text}"`);

    if (!text) {
      return c.json({ success: false, error: "No text in message" }, 400);
    }

    try {
      // Look up the bot token from the workflow's input nodes
      const db = getDb();
      const dbNodes = await db
        .select()
        .from(workflowNodes)
        .where(and(eq(workflowNodes.stackId, stackId), eq(workflowNodes.isActive, true)));

      const inputNode = dbNodes.find(
        (n) => n.type === "input" && (n.data as Record<string, unknown>)?.inputType === "telegram"
      );
      const botToken = inputNode
        ? ((inputNode.data as Record<string, unknown>)?.botToken as string | undefined)
        : undefined;

      console.log(`[telegram webhook] botToken found: ${botToken ? "yes" : "no"}`);

      // Execute the workflow for this stack, passing Telegram context as session variables
      // so downstream output nodes can reference the original chat
      const result = await runWorkflow({
        stackId,
        message: text,
        sessionVariables: {
          __telegramChatId: chatId ? String(chatId) : "",
          __telegramBotToken: botToken || "",
        },
      });
      console.log("[telegram webhook] workflow result:", result);

      // Collect final output responses (exclude internal dispatch logs)
      const responses = result.outputs
        .filter((o) => o.response && !o.response.startsWith("[") && !o.response.startsWith("Error"))
        .map((o) => o.response)
        .join("\n\n");

      // Send response back to Telegram if we have a chatId and bot token
      if (chatId && botToken) {
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: responses || "Workflow executed (no output)",
            }),
          });
          const tgData = await tgRes.json().catch(() => ({})) as Record<string, unknown>;
          console.log("[telegram webhook] sendMessage result:", tgData.ok ? "ok" : JSON.stringify(tgData));
        } catch (err) {
          console.error("[telegram webhook] failed to send response:", err);
        }
      } else {
        console.warn("[telegram webhook] cannot reply: missing chatId or botToken");
      }

      return c.json({ success: true, executed: result.executed, outputs: result.outputs.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[telegram webhook] execution error:", msg);
      return c.json({ success: false, error: msg }, 500);
    }
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

  // ─── Public API v1: Run Workflow ───
  app.post("/api/v1/:stackId/run", publicApiMiddleware("run"), async (c) => {
    const stackId = Number(c.req.param("stackId"));
    const body = await c.req.json().catch(() => ({}));
    const message = body.message || "";
    const variables = body.variables || {};

    if (!message) {
      return c.json({ error: "Missing 'message' field" }, 400);
    }

    try {
      const result = await runWorkflow({
        stackId,
        message,
        sessionVariables: variables,
        trigger: "api",
      });

      return c.json({
        success: result.success,
        runId: result.runId,
        executed: result.executed,
        outputs: result.outputs,
        sessionVariables: result.sessionVariables,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  // ─── Public API v1: List Agents ───
  app.get("/api/v1/:stackId/agents", publicApiMiddleware("agents"), async (c) => {
    const stackId = Number(c.req.param("stackId"));
    const db = getDb();

    const agents = await db
      .select({
        id: aiAgents.id,
        slug: aiAgents.slug,
        name: aiAgents.name,
        agentType: aiAgents.agentType,
        description: aiAgents.description,
        modelProvider: aiAgents.modelProvider,
        modelName: aiAgents.modelName,
        isEnabled: aiAgents.isEnabled,
      })
      .from(aiAgents)
      .where(eq(aiAgents.stackId, stackId))
      .orderBy(aiAgents.name);

    return c.json({ agents });
  });

  // ─── Public API v1: Chat with Agent ───
  app.post("/api/v1/:stackId/agents/:agentId/chat", publicApiMiddleware("chat"), async (c) => {
    const stackId = Number(c.req.param("stackId"));
    const agentId = Number(c.req.param("agentId"));
    const body = await c.req.json().catch(() => ({}));
    const message = body.message || "";

    if (!message) {
      return c.json({ error: "Missing 'message' field" }, 400);
    }

    try {
      const { resolveAgentCredential } = await import("./lib/workflow-engine");
      const { callLlm } = await import("./lib/llm-provider");

      const config = await resolveAgentCredential(agentId);

      const result = await callLlm({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        systemPrompt: config.systemPrompt,
        messages: [{ role: "user", content: message }],
        temperature: (config.temperature ?? 70) / 100,
        maxTokens: config.maxTokens,
      });

      return c.json({
        response: result.content,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
        agentName: config.agent.name,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  // ─── Public API v1: Get Execution Run ───
  app.get("/api/v1/:stackId/executions/:runId", publicApiMiddleware("executions"), async (c) => {
    const runId = Number(c.req.param("runId"));
    const db = getDb();

    const [row] = await db
      .select()
      .from(executionRuns)
      .where(eq(executionRuns.id, runId))
      .limit(1);

    if (!row) {
      return c.json({ error: "Execution run not found" }, 404);
    }

    return c.json({
      id: row.id,
      stackId: row.stackId,
      trigger: row.trigger,
      status: row.status,
      inputMessage: row.inputMessage,
      outputs: row.outputs,
      trace: row.trace,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
      durationMs: row.durationMs,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
    });
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

  // Seed default workflow templates
  await seedTemplates();

  // Seed default stack blueprints
  await seedBlueprints();

  // Seed default soul templates
  await seedSoulTemplates();

  // Seed default agent functions
  await seedAgentFunctions();

  // Seed default skills taxonomy (safe-fail if migration not yet applied)
  try {
    await seedSkills();
  } catch (err) {
    console.warn("[boot] seedSkills failed — migration may not be applied yet:", (err as Error).message);
  }

  // Start background cron scheduler
  await startScheduler();
  process.on("SIGINT", () => {
    console.log("[boot] Shutting down scheduler...");
    stopScheduler();
    process.exit(0);
  });

  const app = createApp();
  const port = Number(process.env.PORT) || 3000;

  // ─── Auto-kill any existing process on our port ───
  try {
    const netstat = execSync(`netstat -ano | findstr :${port}`).toString();
    const lines = netstat.split("\n").filter((l) => l.includes("LISTENING"));
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) {
        try {
          // Verify it's a Node process before killing
          const tasklist = execSync(`tasklist /FI "PID eq ${pid}"`).toString();
          if (tasklist.toLowerCase().includes("node") || tasklist.toLowerCase().includes("tsx")) {
            execSync(`taskkill /F /PID ${pid}`);
            console.log(`[boot] Killed stale Node process PID=${pid} on port ${port}`);
          }
        } catch {
          // Process may have already exited
        }
      }
    }
  } catch {
    // No process found on port — that's fine
  }

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
