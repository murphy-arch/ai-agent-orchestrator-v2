import { eq, and, desc, like } from "drizzle-orm";
import { getDb } from "@db/connection";
import {
  aiAgents,
  agentCredentials,
  apiKeys,
  conversations,
  agentLogs,
  workflowNodes,
  workflowEdges,
  memories,
  executionRuns,
  agentSouls,
  humanApprovals,
} from "@db/schema";
import { decrypt } from "./crypto";
import { callLlm } from "./llm-provider";
import { dispatchOutput } from "./dispatch-output";
import { saveAgentOutput } from "./save-output";
import { broadcastLog } from "./log-broadcaster";
import { retrieveRelevantChunks, searchChunksByText } from "./rag-engine";

// ─── Helper: load agent config + decrypt API key ───
export async function resolveAgentCredential(agentId: number) {
  const db = getDb()!;

  const [agent] = await db
    .select()
    .from(aiAgents)
    .where(eq(aiAgents.id, agentId))
    .limit(1);

  if (!agent) throw new Error("Agent not found");
  if (!agent.isEnabled) throw new Error(`Agent "${agent.name}" is disabled`);

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
    throw new Error(`Agent "${agent.name}" has no API key configured.`);
  }

  // Load agent's personalized soul, if any
  const [soul] = await db
    .select()
    .from(agentSouls)
    .where(eq(agentSouls.agentId, agentId))
    .limit(1);

  let systemPrompt = agent.systemPrompt ?? "You are a helpful assistant.";
  if (soul?.content) {
    systemPrompt = `${soul.content}\n\n---\n\n${systemPrompt}`;
  }

  return {
    agent,
    apiKey,
    provider,
    model: cred?.modelOverride || agent.modelName || "gpt-4o",
    systemPrompt,
    temperature: agent.temperature ?? 0.7,
    maxTokens: agent.maxTokens ?? 2048,
  };
}

// ─── Helper: load recent conversation history ───
async function loadConversationHistory(stackId: number, agentId: number, limit = 20) {
  const db = getDb()!;
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.stackId, stackId), eq(conversations.agentId, agentId)))
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
  const db = getDb()!;
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

// ─── Helper: sleep ───
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Helper: execute output node with formatting, retry, and dispatch ───
async function executeOutputNode(
  nodeData: Record<string, unknown>,
  context: string
): Promise<{ ok: boolean; response: string }> {
  const outputType = nodeData.outputType as string | undefined;
  if (!outputType) {
    return { ok: true, response: context };
  }

  // Apply format template if configured
  const formatTemplate = nodeData.formatTemplate as string | undefined;
  const messageToSend = formatTemplate
    ? formatTemplate.replace(/\{\{response\}\}/g, context)
    : context;

  const outConfig = (nodeData.config ?? {}) as Record<string, string>;
  const retryCount = Math.min(Number(nodeData.retryCount ?? 0), 5);
  const retryDelay = Math.max(Number(nodeData.retryDelay ?? 1000), 500);

  let lastErr: Error | undefined;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const dispatchResult = await dispatchOutput(outputType, outConfig, messageToSend);
      return {
        ok: true,
        response: `[${outputType}] ${dispatchResult.detail || dispatchResult.error || "dispatched"}`,
      };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < retryCount) {
        const backoff = retryDelay * Math.pow(2, attempt);
        await sleep(backoff);
      }
    }
  }

  return {
    ok: false,
    response: `[${outputType} Error] ${lastErr?.message || "Unknown error"}`,
  };
}

// ─── Helper: log execution ───
async function logExecution(
  stackId: number,
  agentId: number,
  message: string,
  metadata: Record<string, unknown>
) {
  const db = getDb()!;
  await db.insert(agentLogs).values({
    stackId,
    agentId,
    level: "info",
    message,
    metadata,
  });
}

export interface WorkflowNode {
  id: number;
  agentId?: number | null;
  type: string;
  data?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: number;
  sourceId: number;
  targetId: number;
  condition?: string | null;
}

// ─── Simple condition evaluator ───
export function evaluateCondition(condition: string | null | undefined, context: string): boolean {
  if (!condition || condition.trim() === "") return true;
  const ctx = context.toLowerCase();
  const cond = condition.trim().toLowerCase();

  // Support simple expressions
  if (cond.startsWith("contains:")) {
    const needle = cond.replace("contains:", "").trim();
    return ctx.includes(needle);
  }
  if (cond.startsWith("starts_with:")) {
    const needle = cond.replace("starts_with:", "").trim();
    return context.toLowerCase().startsWith(needle);
  }
  if (cond.startsWith("equals:")) {
    const needle = cond.replace("equals:", "").trim();
    return ctx === needle;
  }
  if (cond.startsWith("regex:")) {
    const pattern = cond.replace("regex:", "").trim();
    try {
      return new RegExp(pattern, "i").test(context);
    } catch {
      return false;
    }
  }
  // Default: treat as contains
  return ctx.includes(cond);
}

export interface WorkflowOutput {
  nodeId: number;
  agentName?: string;
  response: string;
}

// ─── Helper: load relevant memories for a stack ───
async function loadRelevantMemories(stackId: number, context: string, limit = 5) {
  const db = getDb()!;
  // Simple keyword-based memory retrieval
  // In production, this should use embeddings + vector search
  const keywords = context.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
  if (keywords.length === 0) return [];

  const conditions = [eq(memories.stackId, stackId), eq(memories.isActive, true)];
  const rows = await db
    .select()
    .from(memories)
    .where(and(...conditions))
    .orderBy(desc(memories.confidence))
    .limit(50);

  // Score by keyword overlap
  const scored = rows.map((m) => {
    const text = `${m.key} ${m.value}`.toLowerCase();
    const score = keywords.filter((k) => text.includes(k.toLowerCase())).length;
    return { ...m, score };
  });

  return scored.filter((m) => m.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Execute a workflow graph (BFS traversal).
 * Can be called from tRPC mutations or webhook handlers (no auth required).
 */
export async function runWorkflow(opts: {
  stackId: number;
  message: string;
  userId?: number;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  sessionVariables?: Record<string, string>;
  trigger?: string;
}): Promise<{
  success: boolean;
  executed: boolean;
  outputs: WorkflowOutput[];
  sessionVariables: Record<string, string>;
  runId?: number;
  reason?: string;
  paused?: boolean;
  pausedNodeId?: number;
}> {
  const db = getDb()!;
  const startTime = Date.now();
  let nodes = opts.nodes;
  let edges = opts.edges;

  // Create execution run record
  const [runResult] = await db.insert(executionRuns).values({
    stackId: opts.stackId,
    trigger: opts.trigger || "manual",
    status: "running",
    inputMessage: opts.message,
  });
  const runId = Number(runResult.insertId);

  // Load workflow from DB if not provided
  if (!nodes || !edges) {
    const dbNodes = await db
      .select()
      .from(workflowNodes)
      .where(and(eq(workflowNodes.stackId, opts.stackId), eq(workflowNodes.isActive, true)));

    const dbEdges = await db
      .select()
      .from(workflowEdges)
      .where(and(eq(workflowEdges.stackId, opts.stackId), eq(workflowEdges.isActive, true)));

    nodes = dbNodes as WorkflowNode[];
    edges = dbEdges as WorkflowEdge[];
  }

  const nodeList = nodes ?? [];
  const edgeList = edges ?? [];

  if (nodeList.length === 0) {
    await db.update(executionRuns).set({ status: "failed", errorMessage: "No workflow nodes" }).where(eq(executionRuns.id, runId));
    return { success: true, executed: false, outputs: [], sessionVariables: opts.sessionVariables ?? {}, runId, reason: "No workflow nodes" };
  }

  // Build adjacency list with edge conditions
  const adjacency: Record<number, Array<{ targetId: number; condition?: string | null }>> = {};
  for (const n of nodeList) {
    adjacency[n.id] = [];
  }
  for (const e of edgeList) {
    if (adjacency[e.sourceId]) {
      adjacency[e.sourceId].push({ targetId: e.targetId, condition: e.condition });
    }
  }

  // Find input/trigger nodes as starting points
  const inputNodes = nodeList.filter((n) => n.type === "input" || n.type === "trigger");
  const startNodes = inputNodes.length > 0 ? inputNodes : nodeList;

  // Session state (shared across nodes in this run)
  const sessionVars: Record<string, string> = { ...(opts.sessionVariables ?? {}) };

  // Execution trace
  const trace: Array<{
    step: number;
    nodeId: number;
    nodeType: string;
    timestamp: string;
    input: string;
    output?: string;
    tokensUsed?: number;
    latencyMs?: number;
    error?: string;
  }> = [];
  let stepCounter = 0;
  let totalTokens = 0;

  // BFS traversal with error boundaries and conditional edges
  const visited = new Set<string>();
  const queue: Array<{ nodeId: number; context: string; loopCount?: number }> = [];
  const outputs: WorkflowOutput[] = [];

  for (const start of startNodes) {
    queue.push({ nodeId: start.id, context: opts.message, loopCount: 0 });
  }

  while (queue.length > 0) {
    const { nodeId, context, loopCount = 0 } = queue.shift()!;
    const visitKey = `${nodeId}:${loopCount}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    const node = nodeList.find((n) => n.id === nodeId);
    if (!node) continue;

    const nodeType = node.type ?? "";
    const nodeData = (node.data ?? {}) as Record<string, unknown>;

    // Helper to queue downstream nodes with condition evaluation
    const queueDownstream = (ctx: string, isErrorPath = false) => {
      const edges = adjacency[nodeId] ?? [];
      for (const edge of edges) {
        // Error boundary routing: if this is an error path, only follow edges marked as error
        // Normal path: skip edges marked as error
        const isErrorEdge = (edge.condition || "").toLowerCase().startsWith("error:");
        if (isErrorPath && !isErrorEdge) continue;
        if (!isErrorPath && isErrorEdge) continue;

        // Evaluate non-error conditions
        if (!isErrorEdge && !evaluateCondition(edge.condition, ctx)) continue;

        queue.push({ nodeId: edge.targetId, context: ctx });
      }
    };

    if (nodeType === "agent") {
      const agentId = node.agentId;
      if (!agentId) {
        queueDownstream(context);
        continue;
      }

      try {
        const config = await resolveAgentCredential(agentId);
        const history = await loadConversationHistory(opts.stackId, agentId, 10);

        // Load relevant memories and inject into system prompt
        const relevantMemories = await loadRelevantMemories(opts.stackId, context);
        let enrichedSystemPrompt = config.systemPrompt;
        if (relevantMemories.length > 0) {
          const memoryBlock = relevantMemories
            .map((m) => `- ${m.key}: ${m.value}`)
            .join("\n");
          enrichedSystemPrompt += `\n\n[Relevant Context from Memory]\n${memoryBlock}`;
        }

        // Inject session variables if any
        if (Object.keys(sessionVars).length > 0) {
          const varsBlock = Object.entries(sessionVars)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join("\n");
          enrichedSystemPrompt += `\n\n[Session Variables]\n${varsBlock}`;
        }

        const result = await callLlm({
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          systemPrompt: enrichedSystemPrompt,
          messages: [...history, { role: "user" as const, content: context }],
          temperature: (config.temperature ?? 70) / 100,
          maxTokens: config.maxTokens,
        });

        await saveConversation(opts.stackId, agentId, context, result.content);
        await saveAgentOutput({
          stackId: opts.stackId,
          agentId,
          workflowRunId: runId,
          name: `Workflow Output: ${config.agent.name} — Node ${nodeId}`,
          description: `Workflow input: ${context.slice(0, 200)}`,
          contentType: "text",
          content: result.content,
          mimeType: "text/plain",
          tags: ["workflow", config.agent.name],
          source: "workflow",
        });
        await logExecution(opts.stackId, agentId, `Workflow LLM call (${config.provider}/${config.model})`, {
          tokensUsed: result.tokensUsed,
          latencyMs: result.latencyMs,
        });

        totalTokens += result.tokensUsed ?? 0;
        trace.push({
          step: ++stepCounter,
          nodeId,
          nodeType: "agent",
          timestamp: new Date().toISOString(),
          input: context,
          output: result.content,
          tokensUsed: result.tokensUsed,
          latencyMs: result.latencyMs,
        });

        outputs.push({ nodeId, agentName: config.agent.name, response: result.content });
        queueDownstream(result.content);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        trace.push({
          step: ++stepCounter,
          nodeId,
          nodeType: "agent",
          timestamp: new Date().toISOString(),
          input: context,
          error: msg,
        });
        outputs.push({ nodeId, agentName: "?", response: `[Error] ${msg}` });
        // Route to error boundary edges
        queueDownstream(msg, true);
      }
    } else if (nodeType === "orchestrator") {
      const agentId = node.agentId;
      if (!agentId) {
        queueDownstream(context);
        continue;
      }

      // Find downstream agent nodes that this orchestrator should manage
      const downstreamEdges = adjacency[nodeId] ?? [];
      const downstreamAgentNodeIds = downstreamEdges
        .map((e) => nodeList.find((n) => n.id === e.targetId))
        .filter((n): n is NonNullable<typeof n> => !!n && (n.type === "agent" || n.type === "orchestrator"))
        .map((n) => n.id);

      if (downstreamAgentNodeIds.length === 0) {
        // No downstream agents — fall back to single-agent behavior
        try {
          const config = await resolveAgentCredential(agentId);
          const history = await loadConversationHistory(opts.stackId, agentId, 10);

          const relevantMemories = await loadRelevantMemories(opts.stackId, context);
          let enrichedSystemPrompt = config.systemPrompt;
          if (relevantMemories.length > 0) {
            const memoryBlock = relevantMemories
              .map((m) => `- ${m.key}: ${m.value}`)
              .join("\n");
            enrichedSystemPrompt += `\n\n[Relevant Context from Memory]\n${memoryBlock}`;
          }
          if (Object.keys(sessionVars).length > 0) {
            const varsBlock = Object.entries(sessionVars)
              .map(([k, v]) => `- ${k}: ${v}`)
              .join("\n");
            enrichedSystemPrompt += `\n\n[Session Variables]\n${varsBlock}`;
          }

          const result = await callLlm({
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model,
            systemPrompt: enrichedSystemPrompt,
            messages: [...history, { role: "user" as const, content: context }],
            temperature: (config.temperature ?? 70) / 100,
            maxTokens: config.maxTokens,
          });

          await saveConversation(opts.stackId, agentId, context, result.content);
          await saveAgentOutput({
            stackId: opts.stackId,
            agentId,
            workflowRunId: runId,
            name: `Workflow Output: ${config.agent.name} — Node ${nodeId}`,
            description: `Workflow input: ${context.slice(0, 200)}`,
            contentType: "text",
            content: result.content,
            mimeType: "text/plain",
            tags: ["workflow", config.agent.name],
            source: "workflow",
          });
          await logExecution(opts.stackId, agentId, `Workflow LLM call (${config.provider}/${config.model})`, {
            tokensUsed: result.tokensUsed,
            latencyMs: result.latencyMs,
          });

          totalTokens += result.tokensUsed ?? 0;
          trace.push({
            step: ++stepCounter,
            nodeId,
            nodeType: "orchestrator",
            timestamp: new Date().toISOString(),
            input: context,
            output: result.content,
            tokensUsed: result.tokensUsed,
            latencyMs: result.latencyMs,
          });

          outputs.push({ nodeId, agentName: config.agent.name, response: result.content });
          queueDownstream(result.content);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          trace.push({
            step: ++stepCounter,
            nodeId,
            nodeType: "orchestrator",
            timestamp: new Date().toISOString(),
            input: context,
            error: msg,
          });
          outputs.push({ nodeId, agentName: "?", response: `[Error] ${msg}` });
          queueDownstream(msg, true);
        }
      } else {
        // True orchestration: delegate to downstream agents
        try {
          const workerIds = downstreamAgentNodeIds
            .map((id) => nodeList.find((n) => n.id === id)?.agentId)
            .filter((id): id is number => !!id);

          const { runOrchestrator } = await import("./orchestrator-engine");
          const result = await runOrchestrator({
            stackId: opts.stackId,
            orchestratorAgentId: agentId,
            workerAgentIds: workerIds,
            message: context,
            mode: "parallel",
          });

          // Mark downstream agent nodes as visited so BFS skips them
          for (const targetId of downstreamAgentNodeIds) {
            visited.add(`${targetId}:0`);
          }

          totalTokens += result.totalTokens;
          trace.push({
            step: ++stepCounter,
            nodeId,
            nodeType: "orchestrator",
            timestamp: new Date().toISOString(),
            input: context,
            output: result.orchestratorResponse,
            tokensUsed: result.totalTokens,
            latencyMs: result.totalLatencyMs,
          });

          outputs.push({ nodeId, agentName: "Orchestrator", response: result.orchestratorResponse });
          queueDownstream(result.orchestratorResponse);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          trace.push({
            step: ++stepCounter,
            nodeId,
            nodeType: "orchestrator",
            timestamp: new Date().toISOString(),
            input: context,
            error: msg,
          });
          outputs.push({ nodeId, agentName: "?", response: `[Orchestrator Error] ${msg}` });
          queueDownstream(msg, true);
        }
      }
    } else if (nodeType === "delay") {
      const delayMs = Number(nodeData.delayMs ?? 1000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      outputs.push({ nodeId, response: `[Delay] ${delayMs}ms` });
      queueDownstream(context);
    } else if (nodeType === "loop") {
      const maxIterations = Number(nodeData.maxIterations ?? 3);
      const loopCondition = (nodeData.loopCondition as string) || "";
      const shouldContinue = evaluateCondition(loopCondition, context) && loopCount < maxIterations;

      if (shouldContinue) {
        outputs.push({ nodeId, response: `[Loop] iteration ${loopCount + 1}/${maxIterations}` });
        // Re-queue this node with incremented loop count
        // Also send context to loop body (downstream nodes)
        for (const edge of adjacency[nodeId] ?? []) {
          const isLoopBack = (edge.condition || "").toLowerCase().startsWith("loop:");
          if (isLoopBack) {
            queue.push({ nodeId: edge.targetId, context, loopCount: loopCount + 1 });
          } else {
            queue.push({ nodeId: edge.targetId, context });
          }
        }
      } else {
        outputs.push({ nodeId, response: `[Loop] completed after ${loopCount} iterations` });
        // Follow exit edges (non-loop edges)
        for (const edge of adjacency[nodeId] ?? []) {
          const isLoopBack = (edge.condition || "").toLowerCase().startsWith("loop:");
          if (!isLoopBack && evaluateCondition(edge.condition, context)) {
            queue.push({ nodeId: edge.targetId, context });
          }
        }
      }
    } else if (nodeType === "parallel") {
      // Fan-out: queue all downstream nodes simultaneously
      outputs.push({ nodeId, response: "[Parallel] fan-out" });
      const edges = adjacency[nodeId] ?? [];
      for (const edge of edges) {
        if (evaluateCondition(edge.condition, context)) {
          queue.push({ nodeId: edge.targetId, context });
        }
      }
    } else if (nodeType === "team") {
      // Multi-agent team collaboration node
      const teamId = Number(nodeData.teamId ?? 0);
      if (!teamId) {
        outputs.push({ nodeId, response: "[Team] No team configured" });
        queueDownstream(context);
      } else {
        try {
          const { runTeamCollaboration } = await import("./multi-agent-engine");
          const result = await runTeamCollaboration({
            stackId: opts.stackId,
            teamId,
            message: context,
            mode: (nodeData.mode as "parallel" | "sequential") ?? "parallel",
          });
          outputs.push({
            nodeId,
            agentName: "Team",
            response: result.orchestratorResponse,
          });
          trace.push({
            step: ++stepCounter,
            nodeId,
            nodeType: "team",
            timestamp: new Date().toISOString(),
            input: context,
            output: result.orchestratorResponse,
            tokensUsed: result.totalTokens,
            latencyMs: result.totalLatencyMs,
          });
          totalTokens += result.totalTokens;
          queueDownstream(result.orchestratorResponse);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          outputs.push({ nodeId, response: `[Team Error] ${msg}` });
          queueDownstream(msg, true);
        }
      }
    } else if (nodeType === "output") {
      outputs.push({ nodeId, response: context });

      const outResult = await executeOutputNode(nodeData, context);
      outputs.push({ nodeId, response: outResult.response });
      queueDownstream(context);
    } else if (nodeType === "memory") {
      // Memory node: store the context as a memory and pass through
      try {
        const memKey = (nodeData.memoryKey as string) || `memory-${Date.now()}`;
        const memCategory = (nodeData.memoryCategory as string) || "workflow";
        await db.insert(memories).values({
          stackId: opts.stackId,
          userId: opts.userId ?? null,
          key: memKey,
          value: context,
          category: memCategory,
          confidence: 100,
        });
        outputs.push({ nodeId, response: `[Memory stored] ${memKey}` });
      } catch {
        // ignore duplicate key errors
      }
      queueDownstream(context);
    } else if (nodeType === "knowledge") {
      // RAG retrieval: fetch relevant chunks and inject into context
      try {
        const topK = Number(nodeData.topK ?? 5);
        const useFallback = nodeData.useFallback === true;

        // Find first active agent to borrow credentials
        const [agent] = await db
          .select()
          .from(aiAgents)
          .where(and(eq(aiAgents.stackId, opts.stackId), eq(aiAgents.isEnabled, true)))
          .limit(1);

        if (!agent) {
          outputs.push({ nodeId, response: "[Knowledge] No active agent found for embeddings" });
          queueDownstream(context);
          continue;
        }

        const config = await resolveAgentCredential(agent.id);
        let chunks = await retrieveRelevantChunks({
          stackId: opts.stackId,
          query: context,
          provider: config.provider,
          apiKey: config.apiKey,
          topK,
        });

        // Fallback to full-text search if embedding search yields nothing
        if (chunks.length === 0 && useFallback) {
          const fallback = await searchChunksByText({ stackId: opts.stackId, query: context, topK });
          chunks = fallback.map((c) => ({ ...c, similarity: 0 }));
        }

        if (chunks.length > 0) {
          const knowledgeBlock = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
          const enrichedContext = `[User Query]\n${context}\n\n[Relevant Knowledge]\n${knowledgeBlock}`;
          outputs.push({ nodeId, response: `[Knowledge] Retrieved ${chunks.length} chunk(s)` });
          queueDownstream(enrichedContext);
        } else {
          outputs.push({ nodeId, response: "[Knowledge] No relevant chunks found" });
          queueDownstream(context);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputs.push({ nodeId, response: `[Knowledge Error] ${msg}` });
        queueDownstream(context);
      }
    } else if (nodeType === "variable-set") {
      // Set a session variable
      const varName = (nodeData.varName as string) || "var";
      sessionVars[varName] = context;
      outputs.push({ nodeId, response: `[Variable set] ${varName} = ${context.slice(0, 50)}...` });
      queueDownstream(context);
    } else if (nodeType === "human-gateway") {
      // Human intervention gateway: pause execution for approval
      const prompt = (nodeData.approvalPrompt as string) || "Approval required to continue.";
      const timeoutMinutes = Number(nodeData.timeoutMinutes ?? 0);
      const timeoutAction = (nodeData.timeoutAction as string) || "approve";

      try {
        await db.insert(humanApprovals).values({
          runId,
          nodeId,
          stackId: opts.stackId,
          status: "pending",
          context,
          prompt,
          timeoutMinutes,
          timeoutAction,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputs.push({ nodeId, response: `[Human Gateway Error] ${msg}` });
        queueDownstream(msg, true);
        continue;
      }

      // Save pause state to the run record
      await db.update(executionRuns).set({
        status: "paused",
        pausedNodeId: nodeId,
        sessionVariables: sessionVars as any,
        outputs: outputs as any,
        trace: trace as any,
        totalTokens,
        durationMs: Date.now() - startTime,
      }).where(eq(executionRuns.id, runId));

      trace.push({
        step: ++stepCounter,
        nodeId,
        nodeType: "human-gateway",
        timestamp: new Date().toISOString(),
        input: context,
        output: `[Paused] Waiting for human approval: ${prompt}`,
      });

      outputs.push({ nodeId, response: `[Paused] Awaiting human approval` });

      return {
        success: true,
        executed: true,
        outputs,
        sessionVariables: sessionVars,
        runId,
        paused: true,
        pausedNodeId: nodeId,
      };
    } else if (nodeType === "condition") {
      const operator = (nodeData.operator as string) || "contains";
      const compareValue = (nodeData.value as string) || "";
      let conditionMet = false;

      switch (operator) {
        case "contains":
          conditionMet = context.toLowerCase().includes(compareValue.toLowerCase());
          break;
        case "equals":
          conditionMet = context === compareValue;
          break;
        case "startsWith":
          conditionMet = context.toLowerCase().startsWith(compareValue.toLowerCase());
          break;
        case "notEmpty":
          conditionMet = context.trim().length > 0;
          break;
        case "greaterThan": {
          const num = Number(context);
          const cmp = Number(compareValue);
          conditionMet = !isNaN(num) && !isNaN(cmp) && num > cmp;
          break;
        }
        case "lessThan": {
          const num = Number(context);
          const cmp = Number(compareValue);
          conditionMet = !isNaN(num) && !isNaN(cmp) && num < cmp;
          break;
        }
        default:
          conditionMet = false;
      }

      outputs.push({
        nodeId,
        response: `[Condition] ${conditionMet ? "TRUE" : "FALSE"} (${operator}${compareValue ? `: "${compareValue}"` : ""})`,
      });

      // Route to true/false edges based on condition
      const edges = adjacency[nodeId] ?? [];
      for (const edge of edges) {
        const edgeCondition = (edge.condition || "").toLowerCase().trim();
        if (conditionMet && edgeCondition === "true") {
          queue.push({ nodeId: edge.targetId, context });
        } else if (!conditionMet && edgeCondition === "false") {
          queue.push({ nodeId: edge.targetId, context });
        } else if (!edgeCondition) {
          // Unlabeled edges follow the true path by default
          if (conditionMet) {
            queue.push({ nodeId: edge.targetId, context });
          }
        }
      }
    } else {
      // Input, trigger, or other node types: just pass context through
      queueDownstream(context);
    }
  }

  const durationMs = Date.now() - startTime;
  // Rough cost estimation: $0.002 per 1K tokens (OpenAI gpt-4o average)
  const totalCost = (totalTokens / 1000) * 0.002;

  await db.update(executionRuns).set({
    status: "completed",
    outputs: outputs as any,
    trace: trace as any,
    totalTokens,
    totalCost: String(totalCost),
    durationMs,
  }).where(eq(executionRuns.id, runId));

  return {
    success: true,
    executed: true,
    outputs,
    sessionVariables: sessionVars,
    runId,
  };
}

// ─── Resume a workflow that was paused at a human-gateway node ───
export async function resumeWorkflow(opts: {
  runId: number;
  decision: "approve" | "reject";
  response?: string;
  userId?: number;
}): Promise<{
  success: boolean;
  outputs: WorkflowOutput[];
  sessionVariables: Record<string, string>;
  runId: number;
}> {
  const db = getDb()!;
  const resumeStartTime = Date.now();

  // Load the paused run
  const [run] = await db.select().from(executionRuns).where(eq(executionRuns.id, opts.runId)).limit(1);
  if (!run) throw new Error("Run not found");
  if (run.status !== "paused") throw new Error(`Run is not paused (status: ${run.status})`);
  if (!run.pausedNodeId) throw new Error("Run has no paused node");

  const stackId = run.stackId;
  const pausedNodeId = run.pausedNodeId;

  // Load the approval record
  const [approval] = await db
    .select()
    .from(humanApprovals)
    .where(and(eq(humanApprovals.runId, opts.runId), eq(humanApprovals.nodeId, pausedNodeId)))
    .limit(1);
  if (!approval) throw new Error("Approval record not found");
  if (approval.status !== "pending") throw new Error(`Approval already ${approval.status}`);

  // Update approval record
  await db.update(humanApprovals).set({
    status: opts.decision,
    response: opts.response || "",
    userId: opts.userId ?? null,
    resolvedAt: new Date(),
  }).where(eq(humanApprovals.id, approval.id));

  // Load workflow from DB
  const dbNodes = await db
    .select()
    .from(workflowNodes)
    .where(and(eq(workflowNodes.stackId, stackId), eq(workflowNodes.isActive, true)));
  const dbEdges = await db
    .select()
    .from(workflowEdges)
    .where(and(eq(workflowEdges.stackId, stackId), eq(workflowEdges.isActive, true)));

  const nodeList = dbNodes as WorkflowNode[];
  const edgeList = dbEdges as WorkflowEdge[];

  // Build adjacency list
  const adjacency: Record<number, Array<{ targetId: number; condition?: string | null }>> = {};
  for (const n of nodeList) {
    adjacency[n.id] = [];
  }
  for (const e of edgeList) {
    if (adjacency[e.sourceId]) {
      adjacency[e.sourceId].push({ targetId: e.targetId, condition: e.condition });
    }
  }

  // Restore state from the run record
  const sessionVars: Record<string, string> = (run.sessionVariables as Record<string, string>) ?? {};
  const outputs: WorkflowOutput[] = (run.outputs as WorkflowOutput[]) ?? [];
  const trace: Array<{
    step: number;
    nodeId: number;
    nodeType: string;
    timestamp: string;
    input: string;
    output?: string;
    tokensUsed?: number;
    latencyMs?: number;
    error?: string;
  }> = (run.trace as any) ?? [];
  let stepCounter = trace.length;
  let totalTokens = run.totalTokens ?? 0;

  // Reconstruct visited set from trace
  const visited = new Set<string>();
  for (const t of trace) {
    visited.add(`${t.nodeId}:0`);
  }

  // Determine resume context
  const resumeContext = opts.decision === "approve"
    ? (opts.response || approval.context || "")
    : `[Rejected] ${opts.response || "Human rejected this step"}`;

  trace.push({
    step: ++stepCounter,
    nodeId: pausedNodeId,
    nodeType: "human-gateway",
    timestamp: new Date().toISOString(),
    input: approval.context || "",
    output: `[${opts.decision.toUpperCase()}] ${opts.response || ""}`,
  });

  outputs.push({
    nodeId: pausedNodeId,
    response: `[Human Gateway] ${opts.decision}${opts.response ? ": " + opts.response : ""}`,
  });

  // Helper to queue downstream nodes with condition evaluation
  const queueDownstream = (nodeId: number, ctx: string, isErrorPath = false) => {
    const edges = adjacency[nodeId] ?? [];
    for (const edge of edges) {
      const isErrorEdge = (edge.condition || "").toLowerCase().startsWith("error:");
      if (isErrorPath && !isErrorEdge) continue;
      if (!isErrorPath && isErrorEdge) continue;
      if (!isErrorEdge && !evaluateCondition(edge.condition, ctx)) continue;
      queue.push({ nodeId: edge.targetId, context: ctx });
    }
  };

  // BFS starting from the paused node's downstream edges
  const queue: Array<{ nodeId: number; context: string; loopCount?: number }> = [];

  if (opts.decision === "approve") {
    queueDownstream(pausedNodeId, resumeContext);
  } else {
    // On reject, route to error-boundary edges
    queueDownstream(pausedNodeId, resumeContext, true);
  }

  while (queue.length > 0) {
    const { nodeId, context, loopCount = 0 } = queue.shift()!;
    const visitKey = `${nodeId}:${loopCount}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    const node = nodeList.find((n) => n.id === nodeId);
    if (!node) continue;

    const nodeType = node.type ?? "";
    const nodeData = (node.data ?? {}) as Record<string, unknown>;

    // Re-define queueDownstream for this node
    const nodeQueueDownstream = (ctx: string, isErrorPath = false) => {
      const edges = adjacency[nodeId] ?? [];
      for (const edge of edges) {
        const isErrorEdge = (edge.condition || "").toLowerCase().startsWith("error:");
        if (isErrorPath && !isErrorEdge) continue;
        if (!isErrorPath && isErrorEdge) continue;
        if (!isErrorEdge && !evaluateCondition(edge.condition, ctx)) continue;
        queue.push({ nodeId: edge.targetId, context: ctx });
      }
    };

    // ─── Agent node (copied from runWorkflow for resume continuity) ───
    if (nodeType === "agent" || nodeType === "orchestrator") {
      const agentId = node.agentId;
      if (!agentId) {
        nodeQueueDownstream(context);
        continue;
      }
      try {
        const config = await resolveAgentCredential(agentId);
        const history = await loadConversationHistory(stackId, agentId, 10);
        const relevantMemories = await loadRelevantMemories(stackId, context);
        let enrichedSystemPrompt = config.systemPrompt;
        if (relevantMemories.length > 0) {
          const memoryBlock = relevantMemories.map((m) => `- ${m.key}: ${m.value}`).join("\n");
          enrichedSystemPrompt += `\n\n[Relevant Context from Memory]\n${memoryBlock}`;
        }
        if (Object.keys(sessionVars).length > 0) {
          const varsBlock = Object.entries(sessionVars).map(([k, v]) => `- ${k}: ${v}`).join("\n");
          enrichedSystemPrompt += `\n\n[Session Variables]\n${varsBlock}`;
        }
        const result = await callLlm({
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          systemPrompt: enrichedSystemPrompt,
          messages: [...history, { role: "user" as const, content: context }],
          temperature: (config.temperature ?? 70) / 100,
          maxTokens: config.maxTokens,
        });
        await saveConversation(stackId, agentId, context, result.content);
        await saveAgentOutput({
          stackId,
          agentId,
          workflowRunId: opts.runId,
          name: `Workflow Output: ${config.agent.name} — Node ${nodeId}`,
          description: `Workflow input: ${context.slice(0, 200)}`,
          contentType: "text",
          content: result.content,
          mimeType: "text/plain",
          tags: ["workflow", config.agent.name],
          source: "workflow",
        });
        await logExecution(stackId, agentId, `Workflow LLM call (${config.provider}/${config.model})`, {
          tokensUsed: result.tokensUsed,
          latencyMs: result.latencyMs,
        });
        totalTokens += result.tokensUsed ?? 0;
        trace.push({
          step: ++stepCounter,
          nodeId,
          nodeType: "agent",
          timestamp: new Date().toISOString(),
          input: context,
          output: result.content,
          tokensUsed: result.tokensUsed,
          latencyMs: result.latencyMs,
        });
        outputs.push({ nodeId, agentName: config.agent.name, response: result.content });
        nodeQueueDownstream(result.content);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        trace.push({ step: ++stepCounter, nodeId, nodeType: "agent", timestamp: new Date().toISOString(), input: context, error: msg });
        outputs.push({ nodeId, agentName: "?", response: `[Error] ${msg}` });
        nodeQueueDownstream(msg, true);
      }
    } else if (nodeType === "delay") {
      const delayMs = Number(nodeData.delayMs ?? 1000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      outputs.push({ nodeId, response: `[Delay] ${delayMs}ms` });
      nodeQueueDownstream(context);
    } else if (nodeType === "parallel") {
      outputs.push({ nodeId, response: "[Parallel] fan-out" });
      const edges = adjacency[nodeId] ?? [];
      for (const edge of edges) {
        if (evaluateCondition(edge.condition, context)) {
          queue.push({ nodeId: edge.targetId, context });
        }
      }
    } else if (nodeType === "output") {
      outputs.push({ nodeId, response: context });
      const outResult = await executeOutputNode(nodeData, context);
      outputs.push({ nodeId, response: outResult.response });
      nodeQueueDownstream(context);
    } else if (nodeType === "memory") {
      try {
        const memKey = (nodeData.memoryKey as string) || `memory-${Date.now()}`;
        const memCategory = (nodeData.memoryCategory as string) || "workflow";
        await db.insert(memories).values({
          stackId,
          userId: opts.userId ?? null,
          key: memKey,
          value: context,
          category: memCategory,
          confidence: 100,
        });
        outputs.push({ nodeId, response: `[Memory stored] ${memKey}` });
      } catch { /* ignore */ }
      nodeQueueDownstream(context);
    } else if (nodeType === "knowledge") {
      try {
        const topK = Number(nodeData.topK ?? 5);
        const useFallback = nodeData.useFallback === true;
        const [agent] = await db.select().from(aiAgents).where(and(eq(aiAgents.stackId, stackId), eq(aiAgents.isEnabled, true))).limit(1);
        if (!agent) {
          outputs.push({ nodeId, response: "[Knowledge] No active agent found for embeddings" });
          nodeQueueDownstream(context);
          continue;
        }
        const config = await resolveAgentCredential(agent.id);
        let chunks = await retrieveRelevantChunks({ stackId, query: context, provider: config.provider, apiKey: config.apiKey, topK });
        if (chunks.length === 0 && useFallback) {
          const fallback = await searchChunksByText({ stackId, query: context, topK });
          chunks = fallback.map((c) => ({ ...c, similarity: 0 }));
        }
        if (chunks.length > 0) {
          const knowledgeBlock = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
          const enrichedContext = `[User Query]\n${context}\n\n[Relevant Knowledge]\n${knowledgeBlock}`;
          outputs.push({ nodeId, response: `[Knowledge] Retrieved ${chunks.length} chunk(s)` });
          nodeQueueDownstream(enrichedContext);
        } else {
          outputs.push({ nodeId, response: "[Knowledge] No relevant chunks found" });
          nodeQueueDownstream(context);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputs.push({ nodeId, response: `[Knowledge Error] ${msg}` });
        nodeQueueDownstream(context);
      }
    } else if (nodeType === "variable-set") {
      const varName = (nodeData.varName as string) || "var";
      sessionVars[varName] = context;
      outputs.push({ nodeId, response: `[Variable set] ${varName} = ${context.slice(0, 50)}...` });
      nodeQueueDownstream(context);
    } else if (nodeType === "human-gateway") {
      // Nested human gateway: just pass through (or could chain approvals)
      outputs.push({ nodeId, response: "[Human Gateway] Nested gate passed through" });
      nodeQueueDownstream(context);
    } else if (nodeType === "condition") {
      const operator = (nodeData.operator as string) || "contains";
      const compareValue = (nodeData.value as string) || "";
      let conditionMet = false;

      switch (operator) {
        case "contains":
          conditionMet = context.toLowerCase().includes(compareValue.toLowerCase());
          break;
        case "equals":
          conditionMet = context === compareValue;
          break;
        case "startsWith":
          conditionMet = context.toLowerCase().startsWith(compareValue.toLowerCase());
          break;
        case "notEmpty":
          conditionMet = context.trim().length > 0;
          break;
        case "greaterThan": {
          const num = Number(context);
          const cmp = Number(compareValue);
          conditionMet = !isNaN(num) && !isNaN(cmp) && num > cmp;
          break;
        }
        case "lessThan": {
          const num = Number(context);
          const cmp = Number(compareValue);
          conditionMet = !isNaN(num) && !isNaN(cmp) && num < cmp;
          break;
        }
        default:
          conditionMet = false;
      }

      outputs.push({
        nodeId,
        response: `[Condition] ${conditionMet ? "TRUE" : "FALSE"} (${operator}${compareValue ? `: "${compareValue}"` : ""})`,
      });

      const edges = adjacency[nodeId] ?? [];
      for (const edge of edges) {
        const edgeCondition = (edge.condition || "").toLowerCase().trim();
        if (conditionMet && edgeCondition === "true") {
          queue.push({ nodeId: edge.targetId, context });
        } else if (!conditionMet && edgeCondition === "false") {
          queue.push({ nodeId: edge.targetId, context });
        } else if (!edgeCondition && conditionMet) {
          queue.push({ nodeId: edge.targetId, context });
        }
      }
    } else {
      nodeQueueDownstream(context);
    }
  }

  const durationMs = (run.durationMs ?? 0) + (Date.now() - resumeStartTime);
  const totalCost = (totalTokens / 1000) * 0.002;

  await db.update(executionRuns).set({
    status: "completed",
    outputs: outputs as any,
    trace: trace as any,
    totalTokens,
    totalCost: String(totalCost),
    durationMs,
    pausedNodeId: null,
    sessionVariables: null,
  }).where(eq(executionRuns.id, opts.runId));

  return {
    success: true,
    outputs,
    sessionVariables: sessionVars,
    runId: opts.runId,
  };
}
