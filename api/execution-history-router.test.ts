import { describe, it, expect, vi, beforeEach } from "vitest";
import { executionHistoryRouter } from "./execution-history-router";

const mockRows: any[] = [];

function createMockDb(rows: any[] = []) {
  const filterRows = (condition: any) => {
    if (!condition) return rows;
    const chunks = condition.queryChunks || [];
    let colName = "";
    let val: any;
    for (const chunk of chunks) {
      if (chunk.name && !chunk.value) colName = chunk.name;
      if (chunk.value !== undefined && !(chunk.value instanceof Array) && chunk.constructor?.name === "Param") {
        val = chunk.value;
      }
    }
    if (!colName) return rows;
    return rows.filter((r) => r[colName] === val);
  };

  const builder = {
    select: () => ({
      from: () => ({
        where: (condition: any) => {
          const filtered = filterRows(condition);
          const chain = {
            limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
            orderBy: () => ({
              limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
            }),
          };
          return Object.assign(Promise.resolve(filtered), chain);
        },
        orderBy: () => ({
          limit: (n: number) => Promise.resolve(rows.slice(0, n)),
        }),
      }),
    }),
  };

  return builder;
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

// Create a caller with a mock auth context
const caller = executionHistoryRouter.createCaller({
  user: { id: 1, email: "test@example.com", name: "Test", role: "user" },
  c: {} as any,
});

describe("executionHistoryRouter", () => {
  beforeEach(() => {
    mockRows.length = 0;
  });

  describe("list", () => {
    it("returns execution runs ordered by createdAt", async () => {
      mockRows.push(
        { id: 2, stackId: 1, stack_id: 1, status: "completed", trigger: "manual", inputMessage: "hi", totalTokens: 10, totalCost: "0.0001", durationMs: 100, createdAt: new Date() },
        { id: 1, stackId: 1, stack_id: 1, status: "failed", trigger: "webhook", inputMessage: "hello", totalTokens: 5, totalCost: "0.00005", durationMs: 50, createdAt: new Date() }
      );

      const result = await caller.list({ stackId: 1, limit: 50 });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
    });

    it("returns empty array when no runs exist", async () => {
      const result = await caller.list({ stackId: 1, limit: 50 });
      expect(result).toEqual([]);
    });
  });

  describe("getById", () => {
    it("returns a single run by id", async () => {
      mockRows.push({ id: 7, stackId: 1, stack_id: 1, status: "completed", trigger: "manual", inputMessage: "test" });

      const result = await caller.getById({ stackId: 1, runId: 7 });
      expect(result.id).toBe(7);
      expect(result.status).toBe("completed");
    });

    it("throws when run not found", async () => {
      await expect(caller.getById({ stackId: 1, runId: 999 })).rejects.toThrow(
        "Execution run not found"
      );
    });
  });

  describe("costSummary", () => {
    it("aggregates costs correctly", async () => {
      mockRows.push(
        { id: 1, stackId: 1, stack_id: 1, status: "completed", totalTokens: 1000, totalCost: "0.002", durationMs: 200 },
        { id: 2, stackId: 1, stack_id: 1, status: "completed", totalTokens: 2000, totalCost: "0.004", durationMs: 400 },
        { id: 3, stackId: 1, stack_id: 1, status: "failed", totalTokens: 0, totalCost: "0", durationMs: 100 }
      );

      const result = await caller.costSummary({ stackId: 1 });
      expect(result.totalRuns).toBe(3);
      expect(result.totalTokens).toBe(3000);
      expect(result.totalCost).toBeCloseTo(0.006, 6);
      expect(result.avgDuration).toBe(233); // (200+400+100)/3 = 233.33 rounded
      expect(result.recentRuns).toHaveLength(3);
    });

    it("returns zeros when no runs exist", async () => {
      const result = await caller.costSummary({ stackId: 1 });
      expect(result.totalRuns).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.avgDuration).toBe(0);
      expect(result.recentRuns).toEqual([]);
    });
  });
});
