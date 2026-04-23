import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import {
  aiAgents,
  conversations,
  agentLogs,
  workflowNodes,
  workflowEdges,
} from "@db/schema";
import { dispatchOutput } from "./lib/dispatch-output";
import { broadcastLog } from "./lib/log-broadcaster";

export const executionRouter = router({
  // ─── Execute a workflow ───
  executeWorkflow: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        agentId: z.number(),
        message: z.string().min(1),
        nodes: z.array(z.record(z.any())).optional(),
        edges: z.array(z.record(z.any())).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      let nodes = input.nodes;
      let edges = input.edges;

      // Load workflow from DB if not provided
      if (!nodes || !edges) {
        const dbNodes = await db
          .select()
          .from(workflowNodes)
          .where(
            and(
              eq(workflowNodes.stackId, input.stackId),
              eq(workflowNodes.isActive, true)
            )
          );

        const dbEdges = await db
          .select()
          .from(workflowEdges)
          .where(
            and(
              eq(workflowEdges.stackId, input.stackId),
              eq(workflowEdges.isActive, true)
            )
          );

        nodes = dbNodes as typeof nodes;
        edges = dbEdges as typeof edges;
      }

      // Placeholder: log the execution
      await db.insert(agentLogs).values({
        stackId: input.stackId,
        agentId: input.agentId,
        level: "info",
        message: `Workflow execution triggered: "${input.message}"`,
        metadata: JSON.stringify({
          nodes: (nodes ?? []).length,
          edges: (edges ?? []).length,
        }),
      });

      return {
        success: true,
        executed: true,
        nodesUsed: (nodes ?? []).length,
        edgesUsed: (edges ?? []).length,
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
        .orderBy(desc(conversations.createdAt));

      return messages;
    }),

  // ─── Send a message to an agent ───
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

      // Insert user message
      await db.insert(conversations).values({
        stackId: input.stackId,
        agentId: input.agentId,
        role: "user",
        content: input.message,
        source: "web",
      });

      // Placeholder assistant response
      const response = `[Agent ${input.agentId}] Received your message: "${input.message}"`;

      // Insert assistant response
      await db.insert(conversations).values({
        stackId: input.stackId,
        agentId: input.agentId,
        role: "assistant",
        content: response,
        source: "web",
      });

      return { response };
    }),

  // ─── Orchestrator chat ───
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

      // Find the orchestrator agent for this stack
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
          message:
            "No orchestrator agent found in this stack. Create one in the Architecture page.",
        });
      }

      // Placeholder response
      const response = `[${orchestrator.name}] Orchestrator says: "${input.message}"`;

      // Save user message
      await db.insert(conversations).values({
        stackId: input.stackId,
        agentId: orchestrator.id,
        role: "user",
        content: input.message,
        source: "web",
      });

      // Save assistant response
      await db.insert(conversations).values({
        stackId: input.stackId,
        agentId: orchestrator.id,
        role: "assistant",
        content: response,
        source: "web",
      });

      return {
        response,
        agentName: orchestrator.name,
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
