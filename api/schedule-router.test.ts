import { describe, it, expect, vi, beforeEach } from "vitest";
import { scheduleRouter } from "./schedule-router";

const mockRows: any[] = [];

function createMockDb(rows: any[] = []) {
  const makeAwaitable = (data: any, chain: Record<string, any>) => {
    return Object.assign(Promise.resolve(data), chain);
  };

  return {
    select: () => ({
      from: () => ({
        where: () => {
          const filtered = rows;
          return makeAwaitable(filtered, {
            orderBy: () => makeAwaitable(filtered, {
              limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
            }),
            limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
          });
        },
        orderBy: () => makeAwaitable(rows, {
          limit: (n: number) => Promise.resolve(rows.slice(0, n)),
        }),
      }),
    }),
    insert: () => ({
      values: (row: any) => {
        const id = rows.length + 1;
        rows.push({ ...row, id });
        return Promise.resolve([{ insertId: id }]);
      },
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  };
}

vi.mock("@db/connection", () => ({
  getDb: () => createMockDb(mockRows),
}));

vi.mock("@db/schema", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@db/schema")>();
  return mod;
});

vi.mock("./lib/permissions", () => ({
  verifyStackAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lib/scheduler", () => ({
  reloadScheduler: vi.fn().mockResolvedValue(undefined),
  triggerSchedule: vi.fn().mockResolvedValue({ runId: 99 }),
}));

const caller = scheduleRouter.createCaller({
  user: { id: 1, email: "test@example.com", name: "Test", role: "user" },
  c: {} as any,
});

describe("scheduleRouter", () => {
  beforeEach(() => {
    mockRows.length = 0;
  });

  it("lists schedules", async () => {
    mockRows.push(
      { id: 1, stackId: 1, name: "Daily", cronExpression: "0 9 * * *", inputMessage: "go", isActive: true },
      { id: 2, stackId: 1, name: "Weekly", cronExpression: "0 9 * * 1", inputMessage: "weekly", isActive: true }
    );

    const result = await caller.list({ stackId: 1 });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Daily");
  });

  it("creates a schedule", async () => {
    const result = await caller.create({
      stackId: 1,
      name: "Hourly",
      cronExpression: "0 * * * *",
      inputMessage: "check status",
      isActive: true,
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe("Hourly");
  });

  it("updates a schedule", async () => {
    mockRows.push({ id: 5, stackId: 1, name: "Old", cronExpression: "0 0 * * *", inputMessage: "x", isActive: true });

    const result = await caller.update({
      stackId: 1,
      scheduleId: 5,
      name: "New",
    });

    expect(result.success).toBe(true);
  });

  it("deletes a schedule", async () => {
    mockRows.push({ id: 6, stackId: 1, name: "DeleteMe", cronExpression: "* * * * *", inputMessage: "x", isActive: true });

    const result = await caller.delete({ stackId: 1, scheduleId: 6 });
    expect(result.success).toBe(true);
  });

  it("triggers a schedule manually", async () => {
    mockRows.push({ id: 7, stackId: 1, name: "Manual", cronExpression: "0 0 * * *", inputMessage: "run", isActive: true });

    const result = await caller.runNow({ stackId: 1, scheduleId: 7 });
    expect(result.runId).toBe(99);
  });
});
