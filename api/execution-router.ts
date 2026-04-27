import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, asc } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import {
  aiAgents,
  agentCredentials,
  apiKeys,
  conversations,
  agentLogs,
  humanApprovals,
} from "@db/schema";
import { decrypt } from "./lib/crypto";
import { callLlm } from "./lib/llm-provider";
import { saveAgentOutput } from "./lib/save-output";
import { dispatchOutput } from "./lib/dispatch-output";
import { broadcastLog } from "./lib/log-broadcaster";
import { runWorkflow, resumeWorkflow } from "./lib/workflow-engine";

// ─── Helper: load agent config + decrypt API key ───
async function resolveAgentCredential(agentId: number) {
  const db = getDb();

  const [agent] = await db
    .select()
    .from(aiAgents)
    .where(eq(aiAgents.id, agentId))
    .limit(1);

  if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
  if (!agent.isEnabled) throw new TRPCError({ code: "FORBIDDEN", message: `Agent "${agent.name}" is disabled` });

  const [cred] = await db
    .select()
    .from(agentCredentials)
    .where(eq(agentCredentials.agentId, agentId))
    .limit(1);

  let apiKey = "";
  let provider = agent.modelProvider ?? "openai";

  if (cred?.apiKeyId) {
    const [keyRow] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, cred.apiKeyId))
      .limit(1);
    if (keyRow?.keyValue) {
      apiKey = decrypt(keyRow.keyValue);
      provider = keyRow.provider || provider;
    }
  }

  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Agent "${agent.name}" has no API key configured. Add one in Stack Settings.`,
    });
  }

  return {
    agent,
    apiKey,
    provider,
    model: cred?.modelOverride || agent.modelName || "gpt-4o",
    systemPrompt: agent.systemPrompt ?? "You are a helpful assistant.",
    temperature: agent.temperature ?? 0.7,
    maxTokens: agent.maxTokens ?? 2048,
  };
}

// ─── Helper: load recent conversation history ───
async function loadConversationHistory(stackId: number, agentId: number, limit = 20) {
  const db = getDb();
  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.stackId, stackId),
        eq(conversations.agentId, agentId)
      )
    )
    .orderBy(desc(conversations.createdAt))
    .limit(limit);

  return rows.reverse().map((h) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));
}

// ─── Helper: persist a conversation pair ───
async function saveConversation(
  stackId: number,
  agentId: number,
  userContent: string,
  assistantContent: string
) {
  const db = getDb();
  await db.insert(conversations).values({
    stackId,
    agentId,
    role: "user",
    content: userContent,
    source: "web",
  });
  await db.insert(conversations).values({
    stackId,
    agentId,
    role: "assistant",
    content: assistantContent,
    source: "web",
  });
}

// ─── Helper: log execution ───
async function logExecution(
  stackId: number,
  agentId: number,
  message: string,
  metadata: Record<string, unknown>
) {
  const db = getDb();
  await db.insert(agentLogs).values({
    stackId,
    agentId,
    level: "info",
    message,
    metadata,
  });
}

export const executionRouter = router({
  // ─── Execute a workflow (graph traversal) ───
  executeWorkflow: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number().optional(),
        message: z.string().min(1),
        nodes: z.array(z.record(z.any())).optional(),
        edges: z.array(z.record(z.any())).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyStackAccess(ctx.user.id, input.stackId);

      const result = await runWorkflow({
        stackId: input.stackId,
        message: input.message,
        userId: ctx.user.id,
        nodes: input.nodes as any,
        edges: input.edges as any,
      });

      return {
        ...result,
        nodesUsed: input.nodes?.length ?? 0,
        edgesUsed: input.edges?.length ?? 0,
      };
    }),

  // ─── Get conversations for a stack ───
  getConversations: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const conditions = [eq(conversations.stackId, input.stackId)];
      if (input.agentId !== undefined) {
        conditions.push(eq(conversations.agentId, input.agentId));
      }

      const messages = await db
        .select()
        .from(conversations)
        .where(and(...conditions))
        .orderBy(asc(conversations.createdAt), asc(conversations.id));

      return messages;
    }),

  // ─── Send a message to an agent (real LLM) ───
  sendMessage: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number(),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      // Verify agent belongs to this stack
      const [agent] = await db
        .select({ id: aiAgents.id })
        .from(aiAgents)
        .where(and(eq(aiAgents.id, input.agentId), eq(aiAgents.stackId, input.stackId)))
        .limit(1);
      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found in this stack" });
      }

      // 1. Resolve agent + credential
      const config = await resolveAgentCredential(input.agentId);

      // 2. Load conversation history
      const history = await loadConversationHistory(input.stackId, input.agentId);

      // 3. Call LLM
      const result = await callLlm({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        systemPrompt: config.systemPrompt,
        messages: [...history, { role: "user", content: input.message }],
        temperature: (config.temperature ?? 70) / 100,
        maxTokens: config.maxTokens,
      });

      // 4. Persist conversation
      await saveConversation(input.stackId, input.agentId, input.message, result.content);

      // 5. Save to database (file storage)
      await saveAgentOutput({
        stackId: input.stackId,
        agentId: input.agentId,
        name: `Chat: ${config.agent.name} — ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
        description: `User message: ${input.message.slice(0, 200)}`,
        contentType: "text",
        content: result.content,
        mimeType: "text/plain",
        tags: ["chat", config.agent.name],
        source: "console",
      });

      // 6. Log execution
      await logExecution(input.stackId, input.agentId, `LLM response (${config.provider}/${config.model})`, {
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      });

      return {
        response: result.content,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
        agentName: config.agent.name,
      };
    }),

  // ─── Orchestrator chat (true multi-agent delegation) ───
  orchestratorChat: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        message: z.string().min(1),
        conversationHistory: z.array(z.record(z.any())).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      // Find the orchestrator agent
      const [orchestrator] = await db
        .select()
        .from(aiAgents)
        .where(
          and(
            eq(aiAgents.stackId, input.stackId),
            eq(aiAgents.hierarchyRole, "orchestrator"),
            eq(aiAgents.isEnabled, true)
          )
        )
        .limit(1);

      if (!orchestrator) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No orchestrator agent found in this stack. Create one in the Architecture page.",
        });
      }

      // Find all enabled worker agents in the stack (excluding the orchestrator itself)
      const stackAgents = await db
        .select()
        .from(aiAgents)
        .where(and(eq(aiAgents.stackId, input.stackId), eq(aiAgents.isEnabled, true)));

      const workerIds = stackAgents
        .filter((a) => a.id !== orchestrator.id && a.hierarchyRole !== "orchestrator")
        .map((a) => a.id);

      // Fallback to single-agent chat if no workers exist
      if (workerIds.length === 0) {
        const config = await resolveAgentCredential(orchestrator.id);
        const historyMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
        if (input.conversationHistory) {
          for (const h of input.conversationHistory) {
            const role = h.role as string;
            const content = h.content as string;
            if (role === "user" || role === "assistant") {
              historyMessages.push({ role, content });
            }
          }
        }

        const result = await callLlm({
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          systemPrompt: config.systemPrompt,
          messages: [...historyMessages, { role: "user", content: input.message }],
          temperature: (config.temperature ?? 70) / 100,
          maxTokens: config.maxTokens,
        });

        await saveConversation(input.stackId, orchestrator.id, input.message, result.content);
        await saveAgentOutput({
          stackId: input.stackId,
          agentId: orchestrator.id,
          name: `Orchestrator: ${orchestrator.name} — ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
          description: `User message: ${input.message.slice(0, 200)}`,
          contentType: "text",
          content: result.content,
          mimeType: "text/plain",
          tags: ["orchestrator", orchestrator.name],
          source: "console",
        });
        await logExecution(input.stackId, orchestrator.id, `Orchestrator LLM (${config.provider}/${config.model})`, {
          tokensUsed: result.tokensUsed,
          latencyMs: result.latencyMs,
        });

        return {
          response: result.content,
          agentName: orchestrator.name,
          tokensUsed: result.tokensUsed,
          latencyMs: result.latencyMs,
          plan: null,
          workerResults: [],
        };
      }

      // True orchestration: plan → delegate → synthesize
      const { runOrchestrator } = await import("./lib/orchestrator-engine");
      const historyMessages =
        input.conversationHistory
          ?.filter((h) => h.role === "user" || h.role === "assistant")
          .map((h) => ({ role: h.role as "user" | "assistant", content: h.content as string })) ?? [];

      const result = await runOrchestrator({
        stackId: input.stackId,
        orchestratorAgentId: orchestrator.id,
        workerAgentIds: workerIds,
        message: input.message,
        mode: "parallel",
        conversationHistory: historyMessages,
      });

      await saveAgentOutput({
        stackId: input.stackId,
        agentId: orchestrator.id,
        name: `Orchestrator: ${orchestrator.name} — ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
        description: `Delegated to ${result.workerResults.length} workers. Plan: ${result.plan.slice(0, 200)}`,
        contentType: "text",
        content: result.orchestratorResponse,
        mimeType: "text/plain",
        tags: ["orchestrator", orchestrator.name, "delegated"],
        source: "console",
      });

      await logExecution(
        input.stackId,
        orchestrator.id,
        `Orchestrator delegated to ${result.workerResults.length} workers (${result.totalTokens} tokens)`,
        {
          tokensUsed: result.totalTokens,
          latencyMs: result.totalLatencyMs,
          workerCount: result.workerResults.length,
        }
      );

      return {
        response: result.orchestratorResponse,
        agentName: orchestrator.name,
        tokensUsed: result.totalTokens,
        latencyMs: result.totalLatencyMs,
        plan: result.plan,
        workerResults: result.workerResults,
      };
    }),

  // ─── Team chat (multi-agent collaboration) ───
  teamChat: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        teamId: z.number(),
        message: z.string().min(1),
        mode: z.enum(["parallel", "sequential"]).default("parallel"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const { runTeamCollaboration } = await import("./lib/multi-agent-engine");
      const result = await runTeamCollaboration({
        stackId: input.stackId,
        teamId: input.teamId,
        message: input.message,
        mode: input.mode,
      });

      // Save team output to database
      const teamOutput = [
        `## Orchestrator Response\n\n${result.orchestratorResponse}`,
        `\n\n## Team Member Responses\n\n${result.memberResults.map((m: { agentName: string; role: string; response: string }) => `**${m.agentName}** (${m.role}):\n${m.response}`).join("\n\n---\n\n")}`,
      ].join("\n\n");

      await saveAgentOutput({
        stackId: input.stackId,
        name: `Team Chat: Team ${input.teamId} — ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
        description: `User message: ${input.message.slice(0, 200)}`,
        contentType: "markdown",
        content: teamOutput,
        mimeType: "text/markdown",
        tags: ["team", `team-${input.teamId}`],
        source: "team",
      });

      return {
        response: result.orchestratorResponse,
        plan: result.plan,
        memberResults: result.memberResults,
        totalTokens: result.totalTokens,
        totalLatencyMs: result.totalLatencyMs,
      };
    }),

  // ─── Get agent logs ───
  getLogs: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number().optional(),
        limit: z.number().min(1).max(500).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const conditions = [eq(agentLogs.stackId, input.stackId)];
      if (input.agentId !== undefined) {
        conditions.push(eq(agentLogs.agentId, input.agentId));
      }

      const logs = await db
        .select()
        .from(agentLogs)
        .where(and(...conditions))
        .orderBy(desc(agentLogs.createdAt))
        .limit(input.limit);

      return logs;
    }),

  // ─── Dispatch output to external channel ───
  dispatchOutput: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number(),
        outputType: z.string(),
        config: z.record(z.string()),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyStackAccess(ctx.user.id, input.stackId);
      const result = await dispatchOutput(input.outputType, input.config, input.message);
      return result;
    }),

  // ─── Set Telegram webhook ───
  setTelegramWebhook: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        botToken: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyStackAccess(ctx.user.id, input.stackId);

      const baseUrl = process.env.PUBLIC_URL;
      if (!baseUrl) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "PUBLIC_URL env variable is not set. Telegram requires a public HTTPS URL for webhooks. For local testing, set PUBLIC_URL to your ngrok/https tunnel URL (e.g., https://abc123.ngrok.io)",
        });
      }
      const webhookUrl = `${baseUrl}/api/webhook/telegram/${input.stackId}`;

      const res = await fetch(`https://api.telegram.org/bot${input.botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message"],
        }),
      });

      const data = await res.json() as { ok: boolean; description?: string };
      if (!data.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Telegram API error: ${data.description || "Unknown error"}`,
        });
      }

      return { success: true, webhookUrl, description: data.description };
    }),

  // ─── Resume a paused workflow (human gateway approval) ───
  resumePausedRun: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        runId: z.number(),
        decision: z.enum(["approve", "reject"]),
        response: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyStackAccess(ctx.user.id, input.stackId);

      const result = await resumeWorkflow({
        runId: input.runId,
        decision: input.decision,
        response: input.response,
        userId: ctx.user.id,
      });

      return result;
    }),

  // ─── List pending human approvals for a stack ───
  listPendingApprovals: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const approvals = await db
        .select()
        .from(humanApprovals)
        .where(and(eq(humanApprovals.stackId, input.stackId), eq(humanApprovals.status, "pending")))
        .orderBy(desc(humanApprovals.createdAt));

      return approvals;
    }),

  // ─── Broadcast a log entry to SSE clients ───
  broadcastLog: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number(),
        eventType: z.string(),
        message: z.string(),
        metadata: z.string().optional(),
        tokensUsed: z.number().optional(),
        latency: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyStackAccess(ctx.user.id, input.stackId);
      broadcastLog({
        agentId: input.agentId,
        eventType: input.eventType,
        message: input.message,
        metadata: input.metadata,
        tokensUsed: input.tokensUsed,
        latency: input.latency,
      });
      return { success: true };
    }),
});
