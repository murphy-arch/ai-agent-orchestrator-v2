import { eq, and } from "drizzle-orm";
import { getDb } from "@db/connection";
import { aiAgents, conversations, agentLogs } from "@db/schema";
import { resolveAgentCredential } from "./workflow-engine";
import { callLlm } from "./llm-provider";

export interface WorkerResult {
  agentId: number;
  agentName: string;
  role: string;
  task: string;
  response: string;
  tokensUsed: number;
  latencyMs: number;
}

export interface OrchestratorResult {
  orchestratorResponse: string;
  plan: string;
  workerResults: WorkerResult[];
  totalTokens: number;
  totalLatencyMs: number;
}

// Backward-compatible aliases for consumers of the old multi-agent-engine types
export type TeamMemberResult = WorkerResult;
export type TeamCollaborationResult = OrchestratorResult;

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
    source: "orchestrator",
  });
  await db.insert(conversations).values({
    stackId,
    agentId,
    role: "assistant",
    content: assistantContent,
    source: "orchestrator",
  });
}

async function logOrchestratorExecution(
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

async function runWorkerAgent(
  stackId: number,
  agentId: number,
  task: string,
  sharedContext: string
): Promise<WorkerResult> {
  const config = await resolveAgentCredential(agentId);

  const enrichedPrompt = `${config.systemPrompt ?? ""}

[ORCHESTRATOR ASSIGNMENT]
You have been assigned the following task by the orchestrator:

"""
${task}
"""

[SHARED CONTEXT FROM ORCHESTRATOR]
${sharedContext}

Instructions:
- Focus ONLY on your assigned task.
- Do not attempt to answer the user's original message directly unless your task specifically requires it.
- Provide a thorough, detailed response that the orchestrator can use to build the final answer.
- If you need clarification, state what you need clearly.`;

  const start = Date.now();
  const result = await callLlm({
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    systemPrompt: enrichedPrompt,
    messages: [{ role: "user", content: task }],
    temperature: (config.temperature ?? 70) / 100,
    maxTokens: config.maxTokens,
  });
  const latencyMs = Date.now() - start;

  await saveConversation(stackId, agentId, task, result.content);
  await logOrchestratorExecution(
    stackId,
    agentId,
    `Worker response (${config.provider}/${config.model})`,
    { tokensUsed: result.tokensUsed, latencyMs }
  );

  return {
    agentId,
    agentName: config.agent.name,
    role: config.agent.hierarchyRole ?? "worker",
    task,
    response: result.content,
    tokensUsed: result.tokensUsed ?? 0,
    latencyMs,
  };
}

/**
 * Run a true orchestrator: plan → delegate to workers → collect → synthesize.
 */
export async function runOrchestrator(opts: {
  stackId: number;
  orchestratorAgentId: number;
  workerAgentIds: number[];
  message: string;
  mode?: "parallel" | "sequential";
  conversationHistory?: Array<{ role: string; content: string }>;
}): Promise<OrchestratorResult> {
  const db = getDb();
  const {
    stackId,
    orchestratorAgentId,
    workerAgentIds,
    message,
    mode = "parallel",
    conversationHistory,
  } = opts;

  if (workerAgentIds.length === 0) {
    throw new Error("No worker agents provided for orchestration");
  }

  // Load orchestrator
  const [orchestrator] = await db
    .select()
    .from(aiAgents)
    .where(eq(aiAgents.id, orchestratorAgentId))
    .limit(1);

  if (!orchestrator) {
    throw new Error("Orchestrator agent not found");
  }

  const orchestratorConfig = await resolveAgentCredential(orchestrator.id);

  // Load worker details for the prompt
  const allStackAgents = await db
    .select()
    .from(aiAgents)
    .where(and(eq(aiAgents.stackId, stackId), eq(aiAgents.isEnabled, true)));

  const workers = allStackAgents.filter((a) => workerAgentIds.includes(a.id));

  // ─── STEP 1: PLANNING / DELEGATION ───
  const delegationPrompt = `You are ${orchestrator.name}, the orchestrator of a team of AI agents.

THE USER'S REQUEST:
"""
${message}
"""

YOUR TEAM MEMBERS:
${workers
  .map(
    (w, i) =>
      `${i + 1}. ${w.name} (ID: ${w.id}) — Role: ${w.hierarchyRole ?? "worker"}\n   Description: ${w.description ?? "No description"}\n   Specialization: ${w.agentType ?? w.hierarchyRole ?? "general"}`
  )
  .join("\n\n")}

YOUR JOB:
Analyze the user's request and break it down into specific tasks for each team member. Each task should leverage that member's specialization.

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS (one per line):
AGENT_ID: <detailed task description>

Example:
${workers[0]?.id ?? 1}: Research the user's question and provide 3 key facts with sources
${workers[1]?.id ?? 2}: Write a concise summary based on the research findings

Rules:
- Use the exact AGENT_ID numbers shown above.
- Be specific about what each agent should produce.
- Do not assign tasks to yourself (the orchestrator).
- If the request is simple enough for one agent, assign it to the most relevant member and mark others as "No task needed — standby".`;

  const historyMessages =
    conversationHistory
      ?.filter((h) => h.role === "user" || h.role === "assistant")
      .map((h) => ({ role: h.role as "user" | "assistant", content: h.content })) ?? [];

  const planResult = await callLlm({
    provider: orchestratorConfig.provider,
    apiKey: orchestratorConfig.apiKey,
    model: orchestratorConfig.model,
    systemPrompt: `${orchestratorConfig.systemPrompt ?? ""}\n\nYou are the orchestrator. Your role is to analyze requests, delegate tasks to specialists, and synthesize their work into a final answer.`,
    messages: [...historyMessages, { role: "user", content: delegationPrompt }],
    temperature: 0.3,
    maxTokens: 2048,
  });

  // Parse tasks from plan — match "AGENT_ID: task" or numbered lists
  const tasks = new Map<number, string>();
  for (const line of planResult.content.split("\n")) {
    // Match "123: task" or "123. task" or "123) task"
    const match = line.match(/^\s*(\d+)\s*[:.\)]\s*(.+)$/);
    if (match && match[1] && match[2]) {
      const agentId = Number(match[1]);
      const task = match[2].trim();
      if (
        workerAgentIds.includes(agentId) &&
        !task.toLowerCase().includes("standby") &&
        !task.toLowerCase().includes("no task")
      ) {
        tasks.set(agentId, task);
      }
    }
  }

  // Fallback: if parsing failed, assign the original message to all workers
  if (tasks.size === 0) {
    for (const id of workerAgentIds) {
      tasks.set(id, message);
    }
  }

  // ─── STEP 2: EXECUTE WORKERS ───
  const sharedContext = `=== ORIGINAL USER REQUEST ===\n${message}\n\n=== ORCHESTRATOR PLAN ===\n${planResult.content}`;
  const workerResults: WorkerResult[] = [];

  const runOne = async (id: number): Promise<WorkerResult | null> => {
    const task = tasks.get(id);
    if (!task) return null;
    return runWorkerAgent(stackId, id, task, sharedContext).catch(
      (err): WorkerResult => ({
        agentId: id,
        agentName: `Agent ${id}`,
        role: "worker",
        task: task || message,
        response: `[Error] ${err instanceof Error ? err.message : String(err)}`,
        tokensUsed: 0,
        latencyMs: 0,
      })
    );
  };

  if (mode === "parallel") {
    const results = await Promise.all(workerAgentIds.map((id) => runOne(id)));
    workerResults.push(...results.filter((r): r is WorkerResult => r !== null));
  } else {
    for (const id of workerAgentIds) {
      const result = await runOne(id);
      if (result) workerResults.push(result);
    }
  }

  // ─── STEP 3: SYNTHESIS ───
  const synthesisPrompt = `You are ${orchestrator.name}, the orchestrator.

THE USER'S ORIGINAL REQUEST:
"""
${message}
"""

YOUR TEAM'S WORK:
${workerResults
  .map((r) => `--- ${r.agentName} (Task: ${r.task}) ---\n${r.response}`)
  .join("\n\n")}

YOUR JOB:
Synthesize the team's work into a single, cohesive, high-quality final response for the user.
- Do not simply list what each agent did.
- Integrate their contributions into a unified answer.
- Resolve any contradictions between team members.
- Be concise but thorough.`;

  const synthesisStart = Date.now();
  const synthesisResult = await callLlm({
    provider: orchestratorConfig.provider,
    apiKey: orchestratorConfig.apiKey,
    model: orchestratorConfig.model,
    systemPrompt: orchestratorConfig.systemPrompt ?? "",
    messages: [...historyMessages, { role: "user", content: synthesisPrompt }],
    temperature: (orchestratorConfig.temperature ?? 70) / 100,
    maxTokens: orchestratorConfig.maxTokens,
  });
  const synthesisLatency = Date.now() - synthesisStart;

  await saveConversation(stackId, orchestrator.id, message, synthesisResult.content);
  await logOrchestratorExecution(
    stackId,
    orchestrator.id,
    `Orchestrator synthesis (${orchestratorConfig.provider}/${orchestratorConfig.model})`,
    {
      tokensUsed: synthesisResult.tokensUsed,
      latencyMs: synthesisLatency,
      workerCount: workerResults.length,
    }
  );

  const totalTokens =
    (planResult.tokensUsed ?? 0) +
    (synthesisResult.tokensUsed ?? 0) +
    workerResults.reduce((sum, r) => sum + r.tokensUsed, 0);

  const totalLatencyMs =
    synthesisLatency + workerResults.reduce((sum, r) => sum + r.latencyMs, 0);

  return {
    orchestratorResponse: synthesisResult.content,
    plan: planResult.content,
    workerResults,
    totalTokens,
    totalLatencyMs,
  };
}
