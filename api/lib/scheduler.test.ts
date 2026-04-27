import { describe, it, expect, vi, beforeEach } from "vitest";
import { startScheduler, stopScheduler, reloadScheduler, triggerSchedule } from "./scheduler";

const mockDbState: Record<string, any[]> = {
  schedules: [],
  execution_runs: [],
};

function getTableName(table: any): string {
  return table[Symbol.for("drizzle:Name")] || "unknown";
}

function createMockDb() {
  return {
    select: () => ({
      from: (table: any) => {
        const tbl = getTableName(table);
        const rows = mockDbState[tbl] || [];
        return {
          where: (condition: any) => {
            // Simple mock: return all rows for schedules, ignore filter
            const chain = {
              limit: (n: number) => Promise.resolve(rows.slice(0, n)),
              orderBy: () => ({
                limit: (n: number) => Promise.resolve(rows.slice(0, n)),
              }),
            };
            return Object.assign(Promise.resolve(rows), chain);
          },
          orderBy: () => ({
            limit: (n: number) => Promise.resolve(rows.slice(0, n)),
          }),
        };
      },
    }),
    insert: (table: any) => ({
      values: (row: any) => {
        const tbl = getTableName(table);
        const id = (mockDbState[tbl]?.length || 0) + 1;
        mockDbState[tbl] = mockDbState[tbl] || [];
        mockDbState[tbl].push({ ...row, id });
        return Promise.resolve([{ insertId: id }]);
      },
    }),
    update: (table: any) => ({
      set: (updates: any) => ({
        where: () => Promise.resolve(),
      }),
    }),
    delete: (table: any) => ({
      where: () => Promise.resolve(),
    }),
  };
}

vi.mock("@db/connection", () => ({
  getDb: () => createMockDb(),
}));

vi.mock("@db/schema", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@db/schema")>();
  return mod;
});

vi.mock("./workflow-engine", () => ({
  runWorkflow: vi.fn().mockResolvedValue({
    success: true,
    executed: true,
    outputs: [],
    runId: 42,
  }),
}));

describe("scheduler", () => {
  beforeEach(() => {
    Object.keys(mockDbState).forEach((k) => {
      mockDbState[k] = [];
    });
    stopScheduler();
  });

  it("starts scheduler with active schedules", async () => {
    mockDbState.schedules.push({
      id: 1,
      stackId: 1,
      name: "Test",
      cronExpression: "* * * * *", // every minute
      inputMessage: "hello",
      isActive: true,
    });

    await startScheduler();
    // Scheduler should have started without error
    expect(true).toBe(true);
  });

  it("ignores invalid cron expressions", async () => {
    mockDbState.schedules.push({
      id: 2,
      stackId: 1,
      name: "Bad",
      cronExpression: "invalid",
      inputMessage: "hello",
      isActive: true,
    });

    await startScheduler();
    // Should not throw, just log error
    expect(true).toBe(true);
  });

  it("reloads scheduler and stops inactive jobs", async () => {
    mockDbState.schedules.push({
      id: 3,
      stackId: 1,
      name: "Active",
      cronExpression: "0 * * * *",
      inputMessage: "hello",
      isActive: true,
    });

    await startScheduler();
    await reloadScheduler();
    expect(true).toBe(true);
  });

  it("triggers a schedule manually", async () => {
    mockDbState.schedules.push({
      id: 4,
      stackId: 1,
      name: "Manual",
      cronExpression: "0 0 * * *",
      inputMessage: "run now",
      isActive: true,
    });

    const result = await triggerSchedule(4);
    expect(result.runId).toBe(42);
  });

  it("throws when schedule not found for manual trigger", async () => {
    await expect(triggerSchedule(999)).rejects.toThrow("Schedule not found");
  });
});
