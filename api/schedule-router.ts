import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { schedules } from "@db/schema";
import { reloadScheduler } from "./lib/scheduler";

export const scheduleRouter = router({
  // ─── List schedules for a stack ───
  list: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const rows = await db
        .select()
        .from(schedules)
        .where(eq(schedules.stackId, input.stackId))
        .orderBy(desc(schedules.createdAt));

      return rows;
    }),

  // ─── Create a schedule ───
  create: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        name: z.string().min(1).max(255),
        cronExpression: z.string().min(1).max(100),
        inputMessage: z.string().min(1),
        timezone: z.string().default("UTC"),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [result] = await db.insert(schedules).values({
        stackId: input.stackId,
        name: input.name,
        cronExpression: input.cronExpression,
        inputMessage: input.inputMessage,
        isActive: input.isActive,
      });

      const id = Number(result.insertId);

      // Reload scheduler to pick up the new schedule
      await reloadScheduler();

      return { id, ...input };
    }),

  // ─── Update a schedule ───
  update: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        scheduleId: z.number(),
        name: z.string().min(1).max(255).optional(),
        cronExpression: z.string().min(1).max(100).optional(),
        inputMessage: z.string().min(1).optional(),
        timezone: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.cronExpression !== undefined) updateData.cronExpression = input.cronExpression;
      if (input.inputMessage !== undefined) updateData.inputMessage = input.inputMessage;
      if (input.timezone !== undefined) updateData.timezone = input.timezone;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const [existing] = await db
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(eq(schedules.id, input.scheduleId), eq(schedules.stackId, input.stackId)))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found in this stack" });
      }

      await db
        .update(schedules)
        .set(updateData)
        .where(and(eq(schedules.id, input.scheduleId), eq(schedules.stackId, input.stackId)));

      // Reload scheduler to apply changes
      await reloadScheduler();

      return { success: true };
    }),

  // ─── Delete a schedule ───
  delete: authedQuery
    .input(z.object({ stackId: z.number(), scheduleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [existing] = await db
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(eq(schedules.id, input.scheduleId), eq(schedules.stackId, input.stackId)))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found in this stack" });
      }

      await db.delete(schedules).where(and(eq(schedules.id, input.scheduleId), eq(schedules.stackId, input.stackId)));

      // Reload scheduler to remove the deleted job
      await reloadScheduler();

      return { success: true };
    }),

  // ─── Trigger a schedule manually ───
  runNow: authedQuery
    .input(z.object({ stackId: z.number(), scheduleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [existing] = await db
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(eq(schedules.id, input.scheduleId), eq(schedules.stackId, input.stackId)))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found in this stack" });
      }

      const { triggerSchedule } = await import("./lib/scheduler");
      const result = await triggerSchedule(input.scheduleId);

      return result;
    }),
});
