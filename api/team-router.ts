import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { agentTeams, agentTeamMembers, aiAgents } from "@db/schema";

export const teamRouter = router({
  // ─── List teams for a stack ───
  list: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const teams = await db
        .select()
        .from(agentTeams)
        .where(eq(agentTeams.stackId, input.stackId))
        .orderBy(agentTeams.createdAt);

      // Load member counts
      const members = await db
        .select({ teamId: agentTeamMembers.teamId, count: agentTeamMembers.id })
        .from(agentTeamMembers)
        .where(eq(agentTeamMembers.isActive, true));

      const countMap = new Map<number, number>();
      for (const m of members as Array<{ teamId: number }>) {
        countMap.set(m.teamId, (countMap.get(m.teamId) ?? 0) + 1);
      }

      return teams.map((t: typeof teams[number]) => ({
        ...t,
        memberCount: countMap.get(t.id) ?? 0,
      }));
    }),

  // ─── Get a team with members ───
  getById: authedQuery
    .input(z.object({ stackId: z.number(), teamId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [team] = await db
        .select()
        .from(agentTeams)
        .where(and(eq(agentTeams.id, input.teamId), eq(agentTeams.stackId, input.stackId)))
        .limit(1);

      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }

      const members = await db
        .select({
          id: agentTeamMembers.id,
          agentId: agentTeamMembers.agentId,
          role: agentTeamMembers.role,
          orderIndex: agentTeamMembers.orderIndex,
        })
        .from(agentTeamMembers)
        .where(and(eq(agentTeamMembers.teamId, input.teamId), eq(agentTeamMembers.isActive, true)))
        .orderBy(agentTeamMembers.orderIndex);

      // Fetch all agent details for this stack
      const allAgents = await db.select().from(aiAgents).where(eq(aiAgents.stackId, input.stackId));
      const agentMap = new Map(allAgents.map((a: (typeof allAgents)[number]) => [a.id, a]));

      return {
        ...team,
        members: members.map((m: (typeof members)[number]) => ({
          ...m,
          agent: agentMap.get(m.agentId) ?? null,
        })),
      };
    }),

  // ─── Create a team ───
  create: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        orchestratorAgentId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      // Verify orchestrator exists in this stack
      const [agent] = await db
        .select()
        .from(aiAgents)
        .where(and(eq(aiAgents.id, input.orchestratorAgentId), eq(aiAgents.stackId, input.stackId)))
        .limit(1);

      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Orchestrator agent not found in this stack" });
      }

      const [result] = await db.insert(agentTeams).values({
        stackId: input.stackId,
        name: input.name,
        description: input.description,
        orchestratorAgentId: input.orchestratorAgentId,
        isActive: true,
      });

      return { id: Number(result.insertId) };
    }),

  // ─── Update a team ───
  update: authedQuery
    .input(
      z.object({
        teamId: z.number(),
        stackId: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        orchestratorAgentId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.orchestratorAgentId !== undefined) updateData.orchestratorAgentId = input.orchestratorAgentId;

      if (Object.keys(updateData).length > 0) {
        await db
          .update(agentTeams)
          .set(updateData)
          .where(and(eq(agentTeams.id, input.teamId), eq(agentTeams.stackId, input.stackId)));
      }

      return { success: true };
    }),

  // ─── Delete a team (soft) ───
  delete: authedQuery
    .input(z.object({ teamId: z.number(), stackId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      await db
        .update(agentTeams)
        .set({ isActive: false })
        .where(and(eq(agentTeams.id, input.teamId), eq(agentTeams.stackId, input.stackId)));

      return { success: true };
    }),

  // ─── Add member to team ───
  addMember: authedQuery
    .input(
      z.object({
        teamId: z.number(),
        stackId: z.number(),
        agentId: z.number(),
        role: z.string().default("worker"),
        orderIndex: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      // Verify agent exists in this stack
      const [agent] = await db
        .select()
        .from(aiAgents)
        .where(and(eq(aiAgents.id, input.agentId), eq(aiAgents.stackId, input.stackId)))
        .limit(1);

      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found in this stack" });
      }

      // Check for duplicates
      const [existing] = await db
        .select()
        .from(agentTeamMembers)
        .where(
          and(
            eq(agentTeamMembers.teamId, input.teamId),
            eq(agentTeamMembers.agentId, input.agentId),
            eq(agentTeamMembers.isActive, true)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Agent is already a member of this team" });
      }

      const [result] = await db.insert(agentTeamMembers).values({
        teamId: input.teamId,
        agentId: input.agentId,
        role: input.role,
        orderIndex: input.orderIndex,
        isActive: true,
      });

      return { id: Number(result.insertId) };
    }),

  // ─── Remove member from team ───
  removeMember: authedQuery
    .input(z.object({ memberId: z.number(), stackId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      // Verify member belongs to a team in this stack
      const [member] = await db
        .select({ teamId: agentTeamMembers.teamId })
        .from(agentTeamMembers)
        .where(eq(agentTeamMembers.id, input.memberId))
        .limit(1);
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found" });
      }
      const [team] = await db
        .select({ id: agentTeams.id })
        .from(agentTeams)
        .where(and(eq(agentTeams.id, member.teamId), eq(agentTeams.stackId, input.stackId)))
        .limit(1);
      if (!team) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Member does not belong to this stack" });
      }

      await db
        .update(agentTeamMembers)
        .set({ isActive: false })
        .where(eq(agentTeamMembers.id, input.memberId));

      return { success: true };
    }),

  // ─── Run team collaboration ───
  collaborate: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        teamId: z.number(),
        message: z.string().min(1),
        mode: z.enum(["parallel", "sequential"]).default("parallel"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyStackAccess(ctx.user.id, input.stackId);

      const { runTeamCollaboration } = await import("./lib/multi-agent-engine");
      const result = await runTeamCollaboration({
        stackId: input.stackId,
        teamId: input.teamId,
        message: input.message,
        mode: input.mode,
      });

      return result;
    }),
});
