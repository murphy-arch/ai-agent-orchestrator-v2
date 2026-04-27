import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { executionRuns, humanApprovals } from "@db/schema";

export const executionHistoryRouter = router({
  // ─── List execution runs for a stack ───
  list: authedQuery
    .input(z.object({ stackId: z.number(), limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const rows = await db
        .select()
        .from(executionRuns)
        .where(eq(executionRuns.stackId, input.stackId))
        .orderBy(desc(executionRuns.createdAt))
        .limit(input.limit);

      return rows;
    }),

  // ─── Get a single execution run with full trace ───
  getById: authedQuery
    .input(z.object({ stackId: z.number(), runId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [row] = await db
        .select()
        .from(executionRuns)
        .where(eq(executionRuns.id, input.runId))
        .limit(1);

      if (!row) throw new Error("Execution run not found");
      return row;
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

  // ─── Get cost summary for a stack ───
  costSummary: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const rows = await db
        .select()
        .from(executionRuns)
        .where(eq(executionRuns.stackId, input.stackId));

      const totalRuns = rows.length;
      const totalTokens = rows.reduce((sum, r) => sum + (r.totalTokens ?? 0), 0);
      const totalCost = rows.reduce((sum, r) => sum + Number(r.totalCost ?? 0), 0);
      const avgDuration = totalRuns > 0
        ? rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) / totalRuns
        : 0;

      return {
        totalRuns,
        totalTokens,
        totalCost: Number(totalCost.toFixed(6)),
        avgDuration: Math.round(avgDuration),
        recentRuns: rows.slice(0, 10).map((r) => ({
          id: r.id,
          status: r.status,
          trigger: r.trigger,
          totalTokens: r.totalTokens,
          totalCost: Number(r.totalCost ?? 0),
          durationMs: r.durationMs,
          createdAt: r.createdAt,
        })),
      };
    }),
});
