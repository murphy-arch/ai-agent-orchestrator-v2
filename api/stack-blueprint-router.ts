import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, publicQuery, authedQuery, adminQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import {
  stackBlueprints,
  agentFunctions,
  aiAgents,
  agentCredentials,
  apiKeys,
  workflowTemplates,
  workflowNodes,
  workflowEdges,
  agentFunctionSkills,
  skills,
} from "@db/schema";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function resolveApiKeyForStack(stackId: number) {
  const db = getDb();
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.stackId, stackId), eq(apiKeys.isActive, true)))
    .limit(1);
  return key ?? null;
}

async function resolveSkillsForFunction(agentFunctionId: number | null): Promise<string[]> {
  if (!agentFunctionId) return [];
  const db = getDb();
  // Prefer join table skills with names
  const joinSkills = await db
    .select({ name: skills.name })
    .from(agentFunctionSkills)
    .innerJoin(skills, eq(agentFunctionSkills.skillId, skills.id))
    .where(eq(agentFunctionSkills.agentFunctionId, agentFunctionId));
  if (joinSkills.length > 0) {
    return joinSkills.map((s) => s.name).slice(0, 6);
  }
  // Fallback to legacy JSON column
  const [fn] = await db
    .select({ skills: agentFunctions.skills })
    .from(agentFunctions)
    .where(eq(agentFunctions.id, agentFunctionId))
    .limit(1);
  try {
    return fn?.skills ? (JSON.parse(fn.skills as string) as string[]) : [];
  } catch {
    return [];
  }
}

async function findExistingAgentByFunction(opts: {
  stackId: number;
  agentFunctionId: number | null;
  preferredName?: string;
}) {
  const db = getDb();
  if (!opts.agentFunctionId) return null;
  const [existing] = await db
    .select({
      id: aiAgents.id,
      name: aiAgents.name,
      hierarchyRole: aiAgents.hierarchyRole,
      functionId: aiAgents.functionId,
      slug: aiAgents.slug,
    })
    .from(aiAgents)
    .where(
      and(
        eq(aiAgents.stackId, opts.stackId),
        eq(aiAgents.functionId, opts.agentFunctionId),
        eq(aiAgents.isEnabled, true)
      )
    )
    .limit(1);
  return existing ?? null;
}

async function createAgentFromBlueprint(opts: {
  stackId: number;
  userId: number;
  config: {
    agentFunctionSlug: string;
    name?: string;
    hierarchyRole?: string;
    modelProvider?: string;
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
    systemPromptOverride?: string;
  };
}) {
  const db = getDb();
  const { stackId, userId, config } = opts;

  // Look up the agent function to get defaults
  const [agentFn] = await db
    .select()
    .from(agentFunctions)
    .where(eq(agentFunctions.slug, config.agentFunctionSlug))
    .limit(1);

  const name = config.name ?? agentFn?.name ?? "New Agent";
  const systemPrompt = (
    config.systemPromptOverride ??
    agentFn?.recommendedPrompt ??
    ""
  ).replace(/\{\{AGENT_NAME\}\}/g, name);

  const hierarchyRole = config.hierarchyRole ?? agentFn?.hierarchyRole ?? "worker";
  const functionId = agentFn?.id ?? null;

  // ─── Try to reuse an existing agent with the same function ───
  const existing = await findExistingAgentByFunction({ stackId, agentFunctionId: functionId });
  if (existing) {
    // Fetch skills for display enrichment
    const skillNames = await resolveSkillsForFunction(functionId);
    return {
      agentId: existing.id,
      hierarchyRole: existing.hierarchyRole,
      name: existing.name,
      functionName: agentFn?.name ?? null,
      skills: skillNames,
      reused: true as const,
    };
  }

  // ─── Create a new agent with a unique slug ───
  let baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 1;
  // Ensure slug uniqueness globally (slug is globally unique, not per-stack)
  while (true) {
    const [dup] = await db
      .select({ id: aiAgents.id })
      .from(aiAgents)
      .where(eq(aiAgents.slug, slug))
      .limit(1);
    if (!dup) break;
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }

  const [result] = await db.insert(aiAgents).values({
    stackId,
    name,
    description: agentFn?.description ?? null,
    systemPrompt: systemPrompt || null,
    hierarchyRole,
    modelProvider: config.modelProvider ?? agentFn?.recommendedProvider ?? "openai",
    modelName: config.modelName ?? agentFn?.recommendedModel ?? "gpt-4o",
    temperature: config.temperature ?? 70,
    maxTokens: config.maxTokens ?? 2048,
    functionId,
    slug,
    agentType: hierarchyRole,
    isEnabled: true,
    createdBy: userId,
  });

  const agentId = Number(result.insertId);

  // Auto-link first available API key
  const apiKey = await resolveApiKeyForStack(stackId);
  if (apiKey) {
    await db.insert(agentCredentials).values({
      agentId,
      credentialType: apiKey.provider,
      apiKeyId: apiKey.id,
      isActive: true,
    });
  }

  const skillNames = await resolveSkillsForFunction(functionId);

  return {
    agentId,
    hierarchyRole,
    name,
    functionName: agentFn?.name ?? null,
    skills: skillNames,
    reused: false as const,
  };
}

export const stackBlueprintRouter = router({
  // ─── List blueprints ───
  list: publicQuery
    .input(
      z
        .object({
          industry: z.string().optional(),
          category: z.string().optional(),
          complexityLevel: z.number().min(1).max(5).optional(),
          search: z.string().optional(),
          isPremium: z.boolean().optional(),
          limit: z.number().min(1).max(200).optional().default(50),
          offset: z.number().min(0).optional().default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [eq(stackBlueprints.isActive, true)];

      if (input?.industry) conditions.push(eq(stackBlueprints.industry, input.industry));
      if (input?.category) conditions.push(eq(stackBlueprints.category, input.category));
      if (input?.complexityLevel !== undefined)
        conditions.push(eq(stackBlueprints.complexityLevel, input.complexityLevel));
      if (input?.isPremium !== undefined)
        conditions.push(eq(stackBlueprints.isPremium, input.isPremium));
      if (input?.search) {
        conditions.push(
          sql`${stackBlueprints.name} LIKE ${`%${input.search}%`} OR ${stackBlueprints.description} LIKE ${`%${input.search}%`}`
        );
      }

      const rows = await db
        .select()
        .from(stackBlueprints)
        .where(and(...conditions))
        .orderBy(desc(stackBlueprints.usageCount), stackBlueprints.name)
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      return rows;
    }),

  // ─── Get a single blueprint ───
  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(stackBlueprints)
        .where(eq(stackBlueprints.id, input.id))
        .limit(1);
      return row ?? null;
    }),

  // ─── Get a single blueprint by slug ───
  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(stackBlueprints)
        .where(eq(stackBlueprints.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  // ─── Apply a blueprint to a stack ───
  use: authedQuery
    .input(z.object({ stackId: z.number(), blueprintId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [blueprint] = await db
        .select()
        .from(stackBlueprints)
        .where(eq(stackBlueprints.id, input.blueprintId))
        .limit(1);

      if (!blueprint) throw new Error("Blueprint not found");

      const agentConfigs = blueprint.agentConfigs ?? [];
      const createdAgents: Array<{
        id: number;
        name: string;
        hierarchyRole: string;
        functionName?: string | null;
        skills?: string[];
        reused?: boolean;
      }> = [];

      // Create or reuse all agents from the blueprint
      for (const config of agentConfigs) {
        const result = await createAgentFromBlueprint({
          stackId: input.stackId,
          userId: ctx.user.id,
          config,
        });

        createdAgents.push({
          id: result.agentId,
          name: result.name,
          hierarchyRole: result.hierarchyRole,
          functionName: result.functionName,
          skills: result.skills,
          reused: result.reused,
        });
      }

      // If a workflow template is linked, apply it too
      let workflowResult: { nodesInserted: number; edgesInserted: number } | null = null;
      if (blueprint.workflowTemplateId) {
        const [wfTemplate] = await db
          .select()
          .from(workflowTemplates)
          .where(eq(workflowTemplates.id, blueprint.workflowTemplateId))
          .limit(1);

        if (wfTemplate) {
          // Soft-delete existing workflow
          await db
            .update(workflowNodes)
            .set({ isActive: false })
            .where(eq(workflowNodes.stackId, input.stackId));
          await db
            .update(workflowEdges)
            .set({ isActive: false })
            .where(eq(workflowEdges.stackId, input.stackId));

          const templateNodes = (wfTemplate.nodes as Array<{
            id?: number;
            agentId?: number | null;
            type: string;
            positionX?: number;
            positionY?: number;
            data?: Record<string, unknown> & { agentSpec?: Record<string, unknown> };
          }>) || [];

          const templateEdges = (wfTemplate.edges as Array<{
            id?: number;
            sourceId: number;
            targetId: number;
            condition?: string | null;
          }>) || [];

          // Map agent IDs from blueprint to created agents
          // We match by order index since blueprint agentConfigs are ordered
          const idMap = new Map<number, number>();
          for (let i = 0; i < templateNodes.length; i++) {
            const n = templateNodes[i];
            let agentId: number | null = n.agentId ?? null;
            let nodeData: Record<string, unknown> = n.data ? { ...n.data } : {};

            // blueprintAgentIndex can be at root level OR inside data
            const createdIndex =
              (n as Record<string, unknown>).blueprintAgentIndex ??
              (n.data as Record<string, unknown> | undefined)?.blueprintAgentIndex;

            // ─── Agent / Orchestrator nodes: link to created agent ───
            if ((n.type === "agent" || n.type === "orchestrator") && !agentId) {
              if (typeof createdIndex === "number" && createdAgents[createdIndex]) {
                const created = createdAgents[createdIndex];
                agentId = created.id;
                nodeData = {
                  ...nodeData,
                  label: created.name,
                  role: created.hierarchyRole,
                  agentId: created.id,
                  functionName: created.functionName,
                  skills: created.skills ?? [],
                };
              }
            }

            // ─── All nodes need a label for the frontend canvas ───
            if (!nodeData.label || nodeData.label === "") {
              const typeLabelMap: Record<string, string> = {
                trigger: "Trigger",
                input: "Input",
                output: "Output",
                delay: "Delay",
                loop: "Loop",
                parallel: "Parallel",
                team: "Team",
                memory: "Memory",
                knowledge: "Knowledge",
                "variable-set": "Variable",
                "human-gateway": "Human Gateway",
                condition: "Condition",
              };
              nodeData.label = nodeData.label || typeLabelMap[n.type] || n.type;
            }

            // ─── Preserve integration config from template node data ───
            const templateData = n.data as Record<string, unknown> | undefined;
            if (templateData) {
              // Human Gateway config
              if (templateData.approvalPrompt) nodeData.approvalPrompt = templateData.approvalPrompt;
              if (templateData.timeoutMinutes !== undefined) nodeData.timeoutMinutes = templateData.timeoutMinutes;
              if (templateData.timeoutAction) nodeData.timeoutAction = templateData.timeoutAction;
              // Input config
              if (templateData.inputType) nodeData.inputType = templateData.inputType;
              if (templateData.botToken) nodeData.botToken = templateData.botToken;
              if (templateData.sourceName) nodeData.sourceName = templateData.sourceName;
              // Output config
              if (templateData.outputType) nodeData.outputType = templateData.outputType;
              if (templateData.accessToken) nodeData.accessToken = templateData.accessToken;
              if (templateData.folderId) nodeData.folderId = templateData.folderId;
              if (templateData.fileName) nodeData.fileName = templateData.fileName;
              if (templateData.formatTemplate) nodeData.formatTemplate = templateData.formatTemplate;
              if (templateData.retryCount !== undefined) nodeData.retryCount = templateData.retryCount;
              if (templateData.retryDelay !== undefined) nodeData.retryDelay = templateData.retryDelay;
              // Trigger config
              if (templateData.triggerType) nodeData.triggerType = templateData.triggerType;
              if (templateData.cronExpression) nodeData.cronExpression = templateData.cronExpression;
              if (templateData.webhookUrl) nodeData.webhookUrl = templateData.webhookUrl;
              // Condition config
              if (templateData.operator) nodeData.operator = templateData.operator;
              if (templateData.compareValue !== undefined) nodeData.compareValue = templateData.compareValue;
            }

            // Clean up template-only fields from node data
            delete nodeData.agentSpec;
            delete nodeData.blueprintAgentIndex;
            delete nodeData.purpose;

            const [result] = await db.insert(workflowNodes).values({
              stackId: input.stackId,
              agentId,
              type: n.type,
              positionX: n.positionX ?? 0,
              positionY: n.positionY ?? 0,
              data: nodeData,
              isActive: true,
            });
            const newId = Number(result.insertId);
            idMap.set(n.id ?? i + 1, newId);
          }

          for (const e of templateEdges) {
            const sourceNum = idMap.get(e.sourceId) ?? e.sourceId;
            const targetNum = idMap.get(e.targetId) ?? e.targetId;
            await db.insert(workflowEdges).values({
              stackId: input.stackId,
              sourceId: sourceNum,
              targetId: targetNum,
              condition: e.condition ?? null,
              isActive: true,
            });
          }

          workflowResult = {
            nodesInserted: templateNodes.length,
            edgesInserted: templateEdges.length,
          };

          // Increment workflow template usage
          await db
            .update(workflowTemplates)
            .set({ usageCount: (wfTemplate.usageCount ?? 0) + 1 })
            .where(eq(workflowTemplates.id, blueprint.workflowTemplateId));
        }
      }

      // Increment blueprint usage
      await db
        .update(stackBlueprints)
        .set({ usageCount: (blueprint.usageCount ?? 0) + 1 })
        .where(eq(stackBlueprints.id, input.blueprintId));

      return {
        success: true,
        blueprintName: blueprint.name,
        agentsCreated: createdAgents.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.hierarchyRole,
          reused: a.reused ?? false,
        })),
        workflow: workflowResult,
      };
    }),

  // ─── Admin: create a blueprint ───
  create: adminQuery
    .input(
      z.object({
        slug: z.string().min(1).max(100),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        industry: z.string().max(100).optional(),
        category: z.string().max(50).optional(),
        complexityLevel: z.number().min(1).max(5).optional().default(1),
        agentConfigs: z.array(
          z.object({
            agentFunctionSlug: z.string(),
            name: z.string().optional(),
            hierarchyRole: z.string().optional(),
            modelProvider: z.string().optional(),
            modelName: z.string().optional(),
            temperature: z.number().optional(),
            maxTokens: z.number().optional(),
            systemPromptOverride: z.string().optional(),
          })
        ),
        workflowTemplateId: z.number().optional(),
        requiredIntegrations: z.array(z.string()).optional().default([]),
        setupInstructions: z.string().optional(),
        estimatedMonthlyCost: z.record(z.number()).optional().default({}),
        isPremium: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(stackBlueprints).values({
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        industry: input.industry ?? null,
        category: input.category ?? null,
        complexityLevel: input.complexityLevel,
        agentConfigs: input.agentConfigs,
        workflowTemplateId: input.workflowTemplateId ?? null,
        requiredIntegrations: input.requiredIntegrations,
        setupInstructions: input.setupInstructions ?? null,
        estimatedMonthlyCost: input.estimatedMonthlyCost,
        isPremium: input.isPremium,
      });
      return { id: Number(result.insertId), ...input };
    }),

  // ─── Admin: update a blueprint ───
  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        industry: z.string().max(100).optional(),
        category: z.string().max(50).optional(),
        complexityLevel: z.number().min(1).max(5).optional(),
        agentConfigs: z
          .array(
            z.object({
              agentFunctionSlug: z.string(),
              name: z.string().optional(),
              hierarchyRole: z.string().optional(),
              modelProvider: z.string().optional(),
              modelName: z.string().optional(),
              temperature: z.number().optional(),
              maxTokens: z.number().optional(),
              systemPromptOverride: z.string().optional(),
            })
          )
          .optional(),
        workflowTemplateId: z.number().optional(),
        requiredIntegrations: z.array(z.string()).optional(),
        setupInstructions: z.string().optional(),
        estimatedMonthlyCost: z.record(z.number()).optional(),
        isPremium: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db
        .update(stackBlueprints)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(stackBlueprints.id, id));
      return { success: true };
    }),

  // ─── Admin: delete (soft) a blueprint ───
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(stackBlueprints)
        .set({ isActive: false })
        .where(eq(stackBlueprints.id, input.id));
      return { success: true };
    }),
});
