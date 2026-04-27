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

      console.log("[workflow.save] received nodes:", input.nodes.length, "edges:", input.edges.length);
      console.log("[workflow.save] node IDs:", input.nodes.map((n) => n.id));
      console.log("[workflow.save] edge data:", JSON.stringify(input.edges));

      const result = await db.transaction(async (tx) => {
        // Soft-delete all existing nodes and edges for this stack
        await tx
          .update(workflowNodes)
          .set({ isActive: false })
          .where(eq(workflowNodes.stackId, input.stackId));

        await tx
          .update(workflowEdges)
          .set({ isActive: false })
          .where(eq(workflowEdges.stackId, input.stackId));

        // Insert nodes and capture DB-generated IDs
        const nodeIdMap = new Map<number, number>();
        for (const node of input.nodes) {
          const [insertResult] = await tx.insert(workflowNodes).values({
            stackId: input.stackId,
            agentId: node.agentId ?? null,
            type: node.type,
            positionX: node.positionX,
            positionY: node.positionY,
            data: node.data ?? {},
            isActive: true,
          });
          const dbId = Number(insertResult.insertId);
          nodeIdMap.set(node.id ?? dbId, dbId);
          console.log(`[workflow.save] inserted node frontendId=${node.id} -> dbId=${dbId}`);
        }

        // Insert edges using DB-generated node IDs
        let edgesInserted = 0;
        for (const edge of input.edges) {
          const sourceId = nodeIdMap.get(edge.sourceId);
          const targetId = nodeIdMap.get(edge.targetId);
          if (sourceId === undefined || targetId === undefined) {
            console.warn(`[workflow.save] skipping edge ${edge.id}: missing node mapping for sourceId=${edge.sourceId} or targetId=${edge.targetId}. Available:`, Array.from(nodeIdMap.entries()));
            continue;
          }
          await tx.insert(workflowEdges).values({
            stackId: input.stackId,
            sourceId,
            targetId,
            condition: edge.condition ?? null,
            isActive: true,
          });
          edgesInserted++;
          console.log(`[workflow.save] inserted edge ${edge.id}: ${sourceId} -> ${targetId}`);
        }

        return { nodesInserted: input.nodes.length, edgesInserted };
      });

      console.log("[workflow.save] transaction committed:", result);
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

      console.log("[workflow.load] nodes:", nodes.length, "edges:", edges.length);
      if (edges.length > 0) {
        console.log("[workflow.load] edge rows:", JSON.stringify(edges));
      }

      return { nodes, edges };
    }),
});
