import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { workflowNodes, workflowEdges } from "@db/schema";

// ─── Zod Schemas for Workflow Data ───
export const NodeDataSchema = z.object({
  id: z.number().optional(),
  agentId: z.number().nullable().optional(),
  type: z.string().min(1),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  data: z.record(z.any()).optional(),
});

export const EdgeDataSchema = z.object({
  id: z.number().optional(),
  sourceId: z.number(),
  targetId: z.number(),
  condition: z.string().nullable().optional(),
});

export type NodeData = z.infer<typeof NodeDataSchema>;
export type EdgeData = z.infer<typeof EdgeDataSchema>;

export const workflowRouter = router({
  // ─── Save workflow (nodes + edges) for a stack ───
  save: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        nodes: z.array(NodeDataSchema),
        edges: z.array(EdgeDataSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      await db.transaction(async (tx) => {
        // Soft-delete all existing nodes and edges for this stack
        await tx
          .update(workflowNodes)
          .set({ isActive: false })
          .where(eq(workflowNodes.stackId, input.stackId));

        await tx
          .update(workflowEdges)
          .set({ isActive: false })
          .where(eq(workflowEdges.stackId, input.stackId));

        // Insert new nodes
        if (input.nodes.length > 0) {
          for (const node of input.nodes) {
            await tx.insert(workflowNodes).values({
              stackId: input.stackId,
              agentId: node.agentId ?? null,
              type: node.type,
              positionX: node.positionX,
              positionY: node.positionY,
              data: node.data ?? {},
              isActive: true,
            });
          }
        }

        // Insert new edges
        if (input.edges.length > 0) {
          for (const edge of input.edges) {
            await tx.insert(workflowEdges).values({
              stackId: input.stackId,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              condition: edge.condition ?? null,
              isActive: true,
            });
          }
        }
      });

      return { success: true };
    }),

  // ─── Load workflow (active nodes + edges) for a stack ───
  load: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const nodes = await db
        .select()
        .from(workflowNodes)
        .where(
          and(
            eq(workflowNodes.stackId, input.stackId),
            eq(workflowNodes.isActive, true)
          )
        );

      const edges = await db
        .select()
        .from(workflowEdges)
        .where(
          and(
            eq(workflowEdges.stackId, input.stackId),
            eq(workflowEdges.isActive, true)
          )
        );

      return { nodes, edges };
    }),
});
