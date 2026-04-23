import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { conversations, aiAgents } from "@db/schema";

export const analyticsRouter = router({
  // ─── Get analytics for a stack ───
  getAnalytics: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        period: z.enum(["24h", "7d", "30d"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      // Determine date range
      const hoursMap = { "24h": 24, "7d": 168, "30d": 720 };
      const hours = hoursMap[input.period];

      // Total conversations (unique agentId + date combination approximation)
      const [totalConversationsResult] = await db
        .select({
          count: sql<number>`count(distinct concat(${conversations.agentId}, '-', date(${conversations.createdAt})))`,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.stackId, input.stackId),
            sql`${conversations.createdAt} >= date_sub(now(), interval ${hours} hour)`
          )
        );

      // Total messages
      const [totalMessagesResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(conversations)
        .where(
          and(
            eq(conversations.stackId, input.stackId),
            sql`${conversations.createdAt} >= date_sub(now(), interval ${hours} hour)`
          )
        );

      // Messages by agent (grouped)
      const messagesByAgent = await db
        .select({
          agentId: conversations.agentId,
          count: sql<number>`count(*)`,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.stackId, input.stackId),
            sql`${conversations.createdAt} >= date_sub(now(), interval ${hours} hour)`
          )
        )
        .groupBy(conversations.agentId);

      // Messages by day (last N days)
      const daysMap = { "24h": 1, "7d": 7, "30d": 30 };
      const days = daysMap[input.period];

      const messagesByDay = await db
        .select({
          day: sql<string>`date(${conversations.createdAt})`,
          count: sql<number>`count(*)`,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.stackId, input.stackId),
            sql`${conversations.createdAt} >= date_sub(now(), interval ${days} day)`
          )
        )
        .groupBy(sql`date(${conversations.createdAt})`)
        .orderBy(sql`date(${conversations.createdAt})`);

      // Agent activity: message count per agent with agent details
      const agentActivity = await db
        .select({
          agentId: conversations.agentId,
          count: sql<number>`count(*)`,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.stackId, input.stackId),
            sql`${conversations.createdAt} >= date_sub(now(), interval ${hours} hour)`
          )
        )
        .groupBy(conversations.agentId);

      // Fetch agent names to join with activity
      const agents = await db
        .select({
          id: aiAgents.id,
          name: aiAgents.name,
          hierarchyRole: aiAgents.hierarchyRole,
        })
        .from(aiAgents)
        .where(eq(aiAgents.stackId, input.stackId));

      const agentActivityWithDetails = agentActivity.map((a) => {
        const agent = agents.find((ag) => ag.id === a.agentId);
        return {
          agentId: a.agentId,
          messageCount: a.count,
          agentName: agent?.name ?? "Unknown",
          hierarchyRole: agent?.hierarchyRole ?? "unknown",
        };
      });

      return {
        totalConversations: totalConversationsResult?.count ?? 0,
        totalMessages: totalMessagesResult?.count ?? 0,
        messagesByAgent,
        messagesByDay,
        agentActivity: agentActivityWithDetails,
      };
    }),
});
