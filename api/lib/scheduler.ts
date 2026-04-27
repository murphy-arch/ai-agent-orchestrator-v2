import { CronJob } from "cron";
import { eq } from "drizzle-orm";
import { getDb } from "@db/connection";
import { schedules } from "@db/schema";
import { runWorkflow } from "./workflow-engine";

const activeJobs = new Map<number, CronJob>();

/**
 * Load all active schedules from the DB and start their cron jobs.
 */
export async function startScheduler() {
  const db = getDb();
  if (!db) {
    console.warn("[scheduler] DB not available, skipping scheduler init");
    return;
  }

  const rows = await db
    .select()
    .from(schedules)
    .where(eq(schedules.isActive, true));

  for (const row of rows) {
    await registerJob(row);
  }

  console.log(`[scheduler] Started ${activeJobs.size} scheduled job(s)`);
}

/**
 * Stop all running cron jobs.
 */
export function stopScheduler() {
  for (const [id, job] of activeJobs) {
    job.stop();
    console.log(`[scheduler] Stopped job ${id}`);
  }
  activeJobs.clear();
}

/**
 * Reload schedules from DB: stop removed/inactive jobs, start new/active ones.
 */
export async function reloadScheduler() {
  const db = getDb();
  if (!db) return;

  const rows = await db
    .select()
    .from(schedules)
    .where(eq(schedules.isActive, true));

  const activeIds = new Set(rows.map((r) => r.id));

  // Stop jobs that are no longer active
  for (const [id, job] of activeJobs) {
    if (!activeIds.has(id)) {
      job.stop();
      activeJobs.delete(id);
      console.log(`[scheduler] Removed inactive job ${id}`);
    }
  }

  // Start new or updated jobs
  for (const row of rows) {
    const existing = activeJobs.get(row.id);
    if (existing) {
      existing.stop();
      activeJobs.delete(row.id);
    }
    await registerJob(row);
  }

  console.log(`[scheduler] Reloaded: ${activeJobs.size} active job(s)`);
}

/**
 * Register a single schedule row as a cron job.
 */
async function registerJob(row: typeof schedules.$inferSelect) {
  const id = row.id;
  const timezone = row.timezone || "UTC";

  try {
    // Validate by attempting to create a CronJob instance
    const job = new CronJob(
      row.cronExpression,
      async () => {
        console.log(`[scheduler] Running schedule ${id} for stack ${row.stackId} (tz: ${timezone})`);
        const db = getDb();

        try {
          const result = await runWorkflow({
            stackId: row.stackId,
            message: row.inputMessage,
            trigger: "cron",
          });

          if (db) {
            await db
              .update(schedules)
              .set({ lastRunAt: new Date() })
              .where(eq(schedules.id, id));
          }

          console.log(`[scheduler] Schedule ${id} completed. Run #${result.runId}, executed=${result.executed}`);
        } catch (err) {
          console.error(`[scheduler] Schedule ${id} failed:`, err);
        }
      },
      null, // onComplete
      true, // start immediately
      timezone
    );

    activeJobs.set(id, job);
    console.log(`[scheduler] Registered job ${id}: "${row.cronExpression}" in ${timezone}`);
  } catch (err) {
    console.error(`[scheduler] Invalid cron expression for schedule ${id}: "${row.cronExpression}" (${timezone})`, err);
  }
}

/**
 * Immediately trigger a schedule by ID (for testing or manual run).
 */
export async function triggerSchedule(scheduleId: number) {
  const db = getDb();
  if (!db) throw new Error("DB not available");

  const [row] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId))
    .limit(1);

  if (!row) throw new Error("Schedule not found");

  const result = await runWorkflow({
    stackId: row.stackId,
    message: row.inputMessage,
    trigger: "cron",
  });

  await db
    .update(schedules)
    .set({ lastRunAt: new Date() })
    .where(eq(schedules.id, scheduleId));

  return result;
}
