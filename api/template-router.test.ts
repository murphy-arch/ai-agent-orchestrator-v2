import { describe, it, expect, vi, beforeEach } from "vitest";
import { templateRouter } from "./template-router";

const mockWorkflowTemplates: any[] = [];
const mockWorkflowNodes: any[] = [];
const mockWorkflowEdges: any[] = [];
const mockAgents: any[] = [];
const mockAgentSouls: any[] = [];
const mockSoulTemplates: any[] = [];
const mockApiKeys: any[] = [{ id: 1, stackId: 1, provider: "openai", keyLabel: "test", keyValue: "enc" }];
const mockAgentCredentials: any[] = [];

function createMockDb() {
  const makeAwaitable = (data: any, chain: Record<string, any>) => {
    return Object.assign(Promise.resolve(data), chain);
  };

  return {
    select: () => ({
      from: (table: any) => {
        const tbl = table[Symbol.for("drizzle:Name")] || "";
        let rows: any[] = [];
        if (tbl.includes("workflow_template")) rows = mockWorkflowTemplates;
        else if (tbl.includes("workflow_node")) rows = mockWorkflowNodes;
        else if (tbl.includes("workflow_edge")) rows = mockWorkflowEdges;
        else if (tbl.includes("ai_agent")) rows = mockAgents;
        else if (tbl.includes("agent_soul")) rows = mockAgentSouls;
        else if (tbl.includes("soul_template")) rows = mockSoulTemplates;
        else if (tbl.includes("api_key")) rows = mockApiKeys;
        else if (tbl.includes("agent_api_credential")) rows = mockAgentCredentials;

        return {
          where: () => {
            return makeAwaitable(rows, {
              orderBy: () => makeAwaitable(rows, {
                limit: (n: number) => Promise.resolve(rows.slice(0, n)),
              }),
              limit: (n: number) => Promise.resolve(rows.slice(0, n)),
            });
          },
          orderBy: () => makeAwaitable(rows, {
            limit: (n: number) => Promise.resolve(rows.slice(0, n)),
          }),
          limit: (n: number) => Promise.resolve(rows.slice(0, n)),
        };
      },
    }),
    insert: (table: any) => ({
      values: (row: any) => {
        const tbl = table[Symbol.for("drizzle:Name")] || "";
        let target: any[] = [];
        if (tbl.includes("workflow_template")) target = mockWorkflowTemplates;
        else if (tbl.includes("workflow_node")) target = mockWorkflowNodes;
        else if (tbl.includes("workflow_edge")) target = mockWorkflowEdges;
        else if (tbl.includes("ai_agent")) target = mockAgents;
        else if (tbl.includes("agent_soul")) target = mockAgentSouls;
        else if (tbl.includes("api_key")) target = mockApiKeys;
        else if (tbl.includes("agent_api_credential")) target = mockAgentCredentials;

        const id = target.length + 1;
        target.push({ ...row, id });
        return Promise.resolve([{ insertId: id }]);
      },
    }),
    update: (table: any) => ({
      set: (updates: any) => ({
        where: () => Promise.resolve(),
      }),
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

vi.mock("./lib/permissions", () => ({
  verifyStackAccess: vi.fn().mockResolvedValue(undefined),
}));

const caller = templateRouter.createCaller({
  user: { id: 1, email: "test@example.com", name: "Test", role: "user" },
  c: {} as any,
});

describe("templateRouter", () => {
  beforeEach(() => {
    mockWorkflowTemplates.length = 0;
    mockWorkflowNodes.length = 0;
    mockWorkflowEdges.length = 0;
    mockAgents.length = 0;
    mockAgentSouls.length = 0;
    mockSoulTemplates.length = 0;
    mockAgentCredentials.length = 0;
  });

  it("lists public templates", async () => {
    mockWorkflowTemplates.push(
      { id: 1, name: "T1", description: "Desc", category: "general", nodes: [], edges: [], isPublic: true, isActive: true, usageCount: 5 },
      { id: 2, name: "T2", description: "Desc2", category: "general", nodes: [], edges: [], isPublic: true, isActive: true, usageCount: 3 }
    );

    const result = await caller.list({});
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("T1");
  });

  it("gets a template by id", async () => {
    mockWorkflowTemplates.push({ id: 7, name: "Special", description: "X", category: "test", nodes: [], edges: [], isPublic: true, isActive: true });

    const result = await caller.getById({ templateId: 7 });
    expect(result.id).toBe(7);
    expect(result.name).toBe("Special");
  });

  it("creates a template", async () => {
    const result = await caller.create({
      name: "My Template",
      description: "A test template",
      category: "test",
      nodes: [{ id: 1, type: "agent" }],
      edges: [],
      isPublic: true,
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe("My Template");
  });

  it("applies a template and creates agents from embedded specs", async () => {
    mockWorkflowTemplates.push({
      id: 3,
      name: "Support Flow",
      description: "A support workflow",
      category: "support",
      nodes: [
        { id: 1, agentId: null, type: "trigger", positionX: 0, positionY: 0, data: { label: "Trigger" } },
        { id: 2, agentId: null, type: "agent", positionX: 200, positionY: 0, data: { label: "Support", agentSpec: { name: "Support Bot", systemPrompt: "You are {{AGENT_NAME}}.", hierarchyRole: "worker", modelProvider: "openai", modelName: "gpt-4o", temperature: 70, maxTokens: 2048, functionId: 1, soulTemplateId: null } } },
        { id: 3, agentId: null, type: "output", positionX: 400, positionY: 0, data: { label: "Out" } },
      ],
      edges: [
        { id: 1, sourceId: 1, targetId: 2, condition: null },
        { id: 2, sourceId: 2, targetId: 3, condition: null },
      ],
      isPublic: true,
      isActive: true,
      usageCount: 0,
    });

    const result = await caller.use({ stackId: 1, templateId: 3 });
    expect(result.success).toBe(true);
    expect(result.nodesInserted).toBe(3);
    expect(result.edgesInserted).toBe(2);
    expect(result.agentsCreated).toBe(1);

    // Agent was created
    expect(mockAgents).toHaveLength(1);
    expect(mockAgents[0].name).toBe("Support Bot");
    expect(mockAgents[0].systemPrompt).toBe("You are Support Bot.");

    // Workflow node references the created agent
    expect(mockWorkflowNodes).toHaveLength(3);
    const agentNode = mockWorkflowNodes.find((n: any) => n.type === "agent");
    expect(agentNode.agentId).toBe(1);

    // Credentials linked
    expect(mockAgentCredentials).toHaveLength(1);
    expect(mockAgentCredentials[0].agentId).toBe(1);
  });

  it("applies a template with soul template", async () => {
    mockSoulTemplates.push({ id: 1, name: "Friendly", content: "You are {{AGENT_NAME}}, friendly." });
    mockWorkflowTemplates.push({
      id: 4,
      name: "Soul Flow",
      description: "With soul",
      category: "test",
      nodes: [
        { id: 1, agentId: null, type: "trigger", positionX: 0, positionY: 0, data: { label: "T" } },
        { id: 2, agentId: null, type: "agent", positionX: 200, positionY: 0, data: { label: "A", agentSpec: { name: "Friendly Bot", systemPrompt: "Hi.", hierarchyRole: "worker", soulTemplateId: 1 } } },
      ],
      edges: [{ id: 1, sourceId: 1, targetId: 2, condition: null }],
      isPublic: true,
      isActive: true,
      usageCount: 0,
    });

    await caller.use({ stackId: 1, templateId: 4 });
    expect(mockAgentSouls).toHaveLength(1);
    expect(mockAgentSouls[0].content).toBe("You are Friendly Bot, friendly.");
  });

  it("applies a template with orchestrator node", async () => {
    mockWorkflowTemplates.push({
      id: 5,
      name: "Orchestrator Flow",
      description: "With orchestrator",
      category: "test",
      nodes: [
        { id: 1, agentId: null, type: "trigger", positionX: 0, positionY: 0, data: { label: "T" } },
        { id: 2, agentId: null, type: "orchestrator", positionX: 200, positionY: 0, data: { label: "O", agentSpec: { name: "Boss", systemPrompt: "Lead.", hierarchyRole: "orchestrator" } } },
      ],
      edges: [{ id: 1, sourceId: 1, targetId: 2, condition: null }],
      isPublic: true,
      isActive: true,
      usageCount: 0,
    });

    const result = await caller.use({ stackId: 1, templateId: 5 });
    expect(result.agentsCreated).toBe(1);
    expect(mockAgents[0].hierarchyRole).toBe("orchestrator");
    expect(mockAgents[0].agentType).toBe("orchestrator");
  });

  it("deletes a template (soft delete)", async () => {
    mockWorkflowTemplates.push({ id: 9, name: "Gone", isActive: true, createdBy: 1 });

    const result = await caller.delete({ templateId: 9 });
    expect(result.success).toBe(true);
  });
});
