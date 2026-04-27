import { eq, and } from "drizzle-orm";
import { getDb } from "@db/connection";
import { aiAgents, agentTeamMembers, agentTeams, agentLogs } from "@db/schema";
import { runOrchestrator, type WorkerResult } from "./orchestrator-engine";

export interface TeamMemberResult {
  agentId: number;
  agentName: string;
  role: string;
  response: string;
  tokensUsed: number;
  latencyMs: number;
}

export interface TeamCollaborationResult {
  orchestratorResponse: string;
  plan: string;
  memberResults: TeamMemberResult[];
  totalTokens: number;
  totalLatencyMs: number;
}

// ─── Load team members ───
async function loadTeamMembers(teamId: number): Promise<Array<{ agentId: number; role: string | null; orderIndex: number | null }>> {
  const db = getDb();
  const members = await db
    .select({
      agentId: agentTeamMembers.agentId,
      role: agentTeamMembers.role,
      orderIndex: agentTeamMembers.orderIndex,
    })
    .from(agentTeamMembers)
    .where(and(eq(agentTeamMembers.teamId, teamId), eq(agentTeamMembers.isActive, true)))
    .orderBy(agentTeamMembers.orderIndex);

  return members;
}

// ─── Log execution ───
async function logTeamExecution(
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

// ─── Main collaboration runner ───
export async function runTeamCollaboration(opts: {
  stackId: number;
  teamId: number;
  message: string;
  mode?: "parallel" | "sequential";
}): Promise<TeamCollaborationResult> {
  const db = getDb();
  const { stackId, teamId, message, mode = "parallel" } = opts;

  // Load team + orchestrator
  const [team] = await db
    .select()
    .from(agentTeams)
    .where(and(eq(agentTeams.id, teamId), eq(agentTeams.isActive, true)))
    .limit(1);

  if (!team) {
    throw new Error("Team not found");
  }

  const [orchestrator] = await db
    .select()
    .from(aiAgents)
    .where(eq(aiAgents.id, team.orchestratorAgentId))
    .limit(1);

  if (!orchestrator) {
    throw new Error("Orchestrator agent not found");
  }

  const members = await loadTeamMembers(teamId);
  if (members.length === 0) {
    throw new Error("Team has no active members");
  }

  const result = await runOrchestrator({
    stackId,
    orchestratorAgentId: orchestrator.id,
    workerAgentIds: members.map((m) => m.agentId),
    message,
    mode,
  });

  await logTeamExecution(stackId, orchestrator.id, `Team collaboration complete (${members.length} members)`, {
    teamId,
    memberCount: members.length,
    totalTokens: result.totalTokens,
    totalLatencyMs: result.totalLatencyMs,
  });

  return {
    orchestratorResponse: result.orchestratorResponse,
    plan: result.plan,
    memberResults: result.workerResults.map((r) => ({
      agentId: r.agentId,
      agentName: r.agentName,
      role: r.role,
      response: r.response,
      tokensUsed: r.tokensUsed,
      latencyMs: r.latencyMs,
    })),
    totalTokens: result.totalTokens,
    totalLatencyMs: result.totalLatencyMs,
  };
}
