import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateCondition, runWorkflow, WorkflowNode, WorkflowEdge } from "./workflow-engine";

// ─── Smarter Mock DB ───
const mockDbState: Record<string, any[]> = {
  ai_agents: [],
  agent_api_credentials: [],
  api_keys: [],
  conversations: [],
  agent_logs: [],
  workflow_nodes: [],
  workflow_edges: [],
  memories: [],
  execution_runs: [],
};

function getTableName(table: any): string {
  return table[Symbol.for("drizzle:Name")] || "unknown";
}

function extractEqFilter(condition: any): { column: string; value: any } | null {
  try {
    const chunks = condition.queryChunks || [];
    let colName = "";
    let val: any;
    for (const chunk of chunks) {
      if (chunk.name && !chunk.value) colName = chunk.name;
      if (chunk.value !== undefined && !(chunk.value instanceof Array) && chunk.constructor?.name === "Param") {
        val = chunk.value;
      }
    }
    if (colName && val !== undefined) return { column: colName, value: val };
  } catch {
    // ignore
  }
  return null;
}

function matchesFilter(row: any, condition: any): boolean {
  // Handle `and(...)` conditions
  if (condition?.queryChunks?.[0]?.value?.[0] === "(") {
    const chunks = condition.queryChunks || [];
    const filters: Array<{ column: string; value: any }> = [];
    for (const chunk of chunks) {
      if (chunk.queryChunks) {
        const f = extractEqFilter(chunk);
        if (f) filters.push(f);
      }
    }
    return filters.every((f) => row[f.column] === f.value || row[f.column] === undefined && row[f.column.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase())] === f.value);
  }
  const f = extractEqFilter(condition);
  if (!f) return true;
  // Check both DB column name and JS property name
  if (row[f.column] === f.value) return true;
  // Try camelCase conversion
  const camel = f.column.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase());
  return row[camel] === f.value;
}

function createMockDb() {
  const builder = {
    select: () => ({
      from: (table: any) => {
        const tbl = getTableName(table);
        const currentRows = mockDbState[tbl] || [];
        return {
          where: (condition: any) => {
            const filtered = currentRows.filter((r) => matchesFilter(r, condition));
            const chain = {
              limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
              orderBy: () => ({
                limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
              }),
            };
            return Object.assign(Promise.resolve(filtered), chain);
          },
          orderBy: () => ({
            limit: (n: number) => Promise.resolve(currentRows.slice(0, n)),
          }),
        };
      },
    }),
    insert: (table: any) => {
      const tbl = getTableName(table);
      return {
        values: (row: any) => {
          const id = (mockDbState[tbl]?.length || 0) + 1;
          mockDbState[tbl] = mockDbState[tbl] || [];
          mockDbState[tbl].push({ ...row, id });
          return Promise.resolve([{ insertId: id }]);
        },
      };
    },
    update: (table: any) => ({
      set: (updates: any) => ({
        where: () => Promise.resolve(),
      }),
    }),
    delete: (table: any) => ({
      where: () => Promise.resolve(),
    }),
  };

  return builder;
}

vi.mock("@db/connection", () => ({
  getDb: () => createMockDb(),
}));

vi.mock("@db/schema", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@db/schema")>();
  return mod;
});

vi.mock("./crypto", () => ({
  decrypt: (val: string) => val,
}));

vi.mock("./llm-provider", () => ({
  callLlm: vi.fn().mockResolvedValue({
    content: "LLM response",
    tokensUsed: 42,
    latencyMs: 120,
  }),
}));

vi.mock("./dispatch-output", () => ({
  dispatchOutput: vi.fn().mockResolvedValue({ ok: true, detail: "dispatched" }),
}));

vi.mock("./log-broadcaster", () => ({
  broadcastLog: vi.fn(),
}));

// ─── Tests ───
describe("evaluateCondition", () => {
  it("returns true for empty condition", () => {
    expect(evaluateCondition("", "hello world")).toBe(true);
    expect(evaluateCondition(null, "hello world")).toBe(true);
    expect(evaluateCondition(undefined, "hello world")).toBe(true);
  });

  it("evaluates contains:", () => {
    expect(evaluateCondition("contains:world", "hello world")).toBe(true);
    expect(evaluateCondition("contains:WORLD", "hello world")).toBe(true);
    expect(evaluateCondition("contains:foo", "hello world")).toBe(false);
  });

  it("evaluates starts_with:", () => {
    expect(evaluateCondition("starts_with:hello", "hello world")).toBe(true);
    expect(evaluateCondition("starts_with:foo", "hello world")).toBe(false);
  });

  it("evaluates equals:", () => {
    expect(evaluateCondition("equals:hello world", "hello world")).toBe(true);
    expect(evaluateCondition("equals:hello", "hello world")).toBe(false);
  });

  it("evaluates regex:", () => {
    expect(evaluateCondition("regex:^[a-z]+", "hello")).toBe(true);
    expect(evaluateCondition("regex:^[0-9]+$", "hello")).toBe(false);
    expect(evaluateCondition("regex:[invalid", "hello")).toBe(false);
  });

  it("falls back to simple substring match", () => {
    expect(evaluateCondition("world", "hello world")).toBe(true);
    expect(evaluateCondition("foo", "hello world")).toBe(false);
  });
});

describe("runWorkflow", () => {
  beforeEach(() => {
    Object.keys(mockDbState).forEach((k) => {
      mockDbState[k] = [];
    });
  });

  it("returns early when no nodes provided and DB is empty", async () => {
    const result = await runWorkflow({ stackId: 1, message: "hi", nodes: [], edges: [] });
    expect(result.executed).toBe(false);
    expect(result.outputs).toEqual([]);
  });

  it("executes an agent node and records a run", async () => {
    const nodes: WorkflowNode[] = [{ id: 1, type: "agent", agentId: 1, data: {} }];
    const edges: WorkflowEdge[] = [];

    mockDbState.ai_agents.push({
      id: 1,
      name: "Test Agent",
      isEnabled: true,
      modelProvider: "openai",
      modelName: "gpt-4o",
      systemPrompt: "You are a test agent.",
      temperature: 70,
      maxTokens: 2048,
    });
    mockDbState.agent_api_credentials.push({ agentId: 1, agent_id: 1, apiKeyId: 1, api_key_id: 1, modelOverride: null });
    mockDbState.api_keys.push({ id: 1, provider: "openai", keyValue: "sk-test", key_value: "sk-test" });

    const result = await runWorkflow({ stackId: 1, message: "hi", nodes, edges });
    expect(result.executed).toBe(true);
    expect(result.outputs.length).toBeGreaterThan(0);
    expect(result.outputs[0].response).toBe("LLM response");
    expect(result.runId).toBeDefined();
    expect(mockDbState.execution_runs.length).toBeGreaterThan(0);
  });

  it("routes through conditional edges", async () => {
    const nodes: WorkflowNode[] = [
      { id: 1, type: "trigger", data: {} },
      { id: 2, type: "agent", agentId: 1, data: {} },
      { id: 3, type: "output", data: { outputType: "webhook", config: { url: "https://example.com" } } },
      { id: 4, type: "output", data: { outputType: "slack", config: { webhookUrl: "https://slack.com" } } },
    ];
    const edges: WorkflowEdge[] = [
      { id: 1, sourceId: 1, targetId: 2 },
      { id: 2, sourceId: 2, targetId: 3, condition: "contains:yes" },
      { id: 3, sourceId: 2, targetId: 4, condition: "contains:no" },
    ];

    mockDbState.ai_agents.push({
      id: 1,
      name: "Router",
      isEnabled: true,
      modelProvider: "openai",
      modelName: "gpt-4o",
      systemPrompt: "",
      temperature: 70,
      maxTokens: 2048,
    });
    mockDbState.agent_api_credentials.push({ agentId: 1, agent_id: 1, apiKeyId: 1, api_key_id: 1 });
    mockDbState.api_keys.push({ id: 1, provider: "openai", keyValue: "sk-test", key_value: "sk-test" });

    const result = await runWorkflow({ stackId: 1, message: "hi", nodes, edges });
    expect(result.executed).toBe(true);
    // LLM mock returns "LLM response" which doesn't contain "yes" or "no"
    expect(result.outputs.some((o) => o.nodeId === 3)).toBe(false);
    expect(result.outputs.some((o) => o.nodeId === 4)).toBe(false);
  });

  it("handles delay nodes", async () => {
    const nodes: WorkflowNode[] = [
      { id: 1, type: "delay", data: { delayMs: 10 } },
      { id: 2, type: "output", data: {} },
    ];
    const edges: WorkflowEdge[] = [{ id: 1, sourceId: 1, targetId: 2 }];

    const start = Date.now();
    const result = await runWorkflow({ stackId: 1, message: "hi", nodes, edges });
    const elapsed = Date.now() - start;

    expect(result.executed).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(5);
  });

  it("handles loop nodes with maxIterations", async () => {
    const nodes: WorkflowNode[] = [
      { id: 1, type: "loop", data: { maxIterations: 2, loopCondition: "" } },
      { id: 2, type: "output", data: {} },
    ];
    const edges: WorkflowEdge[] = [{ id: 1, sourceId: 1, targetId: 2 }];

    const result = await runWorkflow({ stackId: 1, message: "hi", nodes, edges });
    expect(result.executed).toBe(true);
  });

  it("stores memory on memory nodes", async () => {
    const nodes: WorkflowNode[] = [
      { id: 1, type: "memory", data: { memoryKey: "test-key", memoryCategory: "test" } },
    ];
    const edges: WorkflowEdge[] = [];

    const result = await runWorkflow({ stackId: 1, message: "remember this", nodes, edges });
    expect(result.executed).toBe(true);
    expect(mockDbState.memories.length).toBeGreaterThan(0);
    expect(mockDbState.memories[0].key).toBe("test-key");
  });

  it("sets session variables on variable-set nodes", async () => {
    const nodes: WorkflowNode[] = [
      { id: 1, type: "variable-set", data: { varName: "greeting" } },
    ];
    const edges: WorkflowEdge[] = [];

    const result = await runWorkflow({ stackId: 1, message: "hello", nodes, edges });
    expect(result.executed).toBe(true);
    expect(result.sessionVariables["greeting"]).toBe("hello");
  });
});
