import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  boolean,
  json,
  mysqlEnum,
  decimal,
} from "drizzle-orm/mysql-core";

// ─── Users (global, not stack-scoped) ───
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  role: varchar("role", { length: 20 }).default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Stacks ───
export const stacks = mysqlTable("stacks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  ownerId: int("owner_id").notNull(),
  isDefault: boolean("is_default").default(false),
  status: varchar("status", { length: 20 }).default("active"),
  plan: varchar("plan", { length: 20 }).default("free"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Stack Members (many-to-many with roles) ───
export const stackMembers = mysqlTable("stack_members", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  userId: int("user_id").notNull(),
  role: varchar("role", { length: 20 }).default("member"),
  invitedBy: int("invited_by"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// ─── AI Agents (stack-scoped) ───
export const aiAgents = mysqlTable("ai_agents", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  agentType: varchar("agent_type", { length: 100 }).default("worker"),
  description: text("description"),
  systemPrompt: text("system_prompt"),
  hierarchyRole: varchar("hierarchy_role", { length: 30 }).default("worker"),
  modelProvider: varchar("model_provider", { length: 50 }).default("openai"),
  modelName: varchar("model_name", { length: 100 }).default("gpt-4o"),
  temperature: int("temperature").default(70),
  maxTokens: int("max_tokens").default(2048),
  functionId: int("function_id"),
  isEnabled: boolean("is_enabled").default(true),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Master Password (global, single row) ───
export const masterPassword = mysqlTable("master_password", {
  id: int("id").autoincrement().primaryKey(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── API Keys (stack-scoped) ───
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  keyLabel: varchar("key_label", { length: 255 }).notNull(),
  keyValue: text("key_value").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Workflow Nodes (stack-scoped) ───
export const workflowNodes = mysqlTable("workflow_nodes", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  agentId: int("agent_id"),
  type: varchar("type", { length: 50 }).notNull(),
  positionX: int("position_x").default(0),
  positionY: int("position_y").default(0),
  data: json("data"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Workflow Edges (stack-scoped) ───
export const workflowEdges = mysqlTable("workflow_edges", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  sourceId: int("source_id").notNull(),
  targetId: int("target_id").notNull(),
  condition: varchar("condition", { length: 255 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Input Sources (stack-scoped) ───
export const inputSources = mysqlTable("input_sources", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull(),
  config: json("config"),
  isActive: boolean("is_active").default(true),
  targetAgentId: int("target_agent_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Memories (stack-scoped, per-user or global) ───
export const memories = mysqlTable("memories", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  userId: int("user_id"), // null = global/stack-wide memory
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  category: varchar("category", { length: 50 }).default("general"),
  confidence: int("confidence").default(100), // 0-100
  sourceConversationId: int("source_conversation_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Documents (RAG knowledge base) ───
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  userId: int("user_id"),
  name: varchar("name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 50 }),
  fileSize: int("file_size"),
  content: text("content"), // extracted text content
  status: varchar("status", { length: 20 }).default("pending"), // pending, processed, error
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Document Chunks (RAG chunks with embeddings) ───
export const documentChunks = mysqlTable("document_chunks", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").notNull(),
  stackId: int("stack_id").notNull(),
  content: text("content").notNull(),
  chunkIndex: int("chunk_index").notNull(),
  embedding: json("embedding"), // array of floats
  metadata: json("metadata"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Session States (ephemeral workflow run state) ───
export const sessionStates = mysqlTable("session_states", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  variables: json("variables"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Execution Runs (workflow trace history) ───
export const executionRuns = mysqlTable("execution_runs", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  trigger: varchar("trigger", { length: 50 }).default("manual"), // manual, telegram, cron, webhook
  status: varchar("status", { length: 20 }).default("running"), // running, completed, failed, paused
  inputMessage: text("input_message"),
  outputs: json("outputs"),
  trace: json("trace"), // array of step objects
  totalTokens: int("total_tokens").default(0),
  totalCost: decimal("total_cost", { precision: 10, scale: 6 }).default("0"),
  durationMs: int("duration_ms"),
  errorMessage: text("error_message"),
  pausedNodeId: int("paused_node_id"), // node that caused a human-gateway pause
  sessionVariables: json("session_variables"), // serialized at pause time
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Human Approvals (workflow human-in-the-loop gates) ───
export const humanApprovals = mysqlTable("human_approvals", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  nodeId: int("node_id").notNull(),
  stackId: int("stack_id").notNull(),
  userId: int("user_id"), // who resolved it
  status: varchar("status", { length: 20 }).default("pending"), // pending, approved, rejected
  context: text("context"), // what was sent for review
  response: text("response"), // human's input / modification
  prompt: text("prompt"), // the approval prompt shown to reviewer
  timeoutMinutes: int("timeout_minutes").default(0),
  timeoutAction: varchar("timeout_action", { length: 20 }).default("approve"), // approve or reject
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// ─── Workflow Schedules (cron triggers) ───
export const schedules = mysqlTable("schedules", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  cronExpression: varchar("cron_expression", { length: 100 }).notNull(),
  inputMessage: text("input_message").notNull(),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  isActive: boolean("is_active").default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Conversations (stack-scoped) ───
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  agentId: int("agent_id").notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 50 }).default("web"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Agent Credentials (links agent to API key) ───
export const agentCredentials = mysqlTable("agent_api_credentials", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agent_id").notNull(),
  credentialType: varchar("credential_type", { length: 100 }).notNull(),
  apiKeyId: int("api_key_id"),
  endpointOverride: varchar("endpoint_override", { length: 500 }),
  modelOverride: varchar("model_override", { length: 255 }),
  additionalConfig: text("additional_config"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Workflow Templates (reusable presets) ───
export const workflowTemplates = mysqlTable("workflow_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).default("general"),
  nodes: json("nodes").notNull(),
  edges: json("edges").notNull(),
  isPublic: boolean("is_public").default(true),
  isActive: boolean("is_active").default(true),
  usageCount: int("usage_count").default(0),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Public API Keys (stack-scoped, for external access) ───
export const publicApiKeys = mysqlTable("public_api_keys", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  keyHash: varchar("key_hash", { length: 255 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  permissions: json("permissions"), // e.g. ["run", "agents", "chat", "executions"]
  rateLimit: int("rate_limit").default(60), // requests per minute
  lastUsedAt: timestamp("last_used_at"),
  requestCount: int("request_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Agent Templates (pre-configured agent blueprints) ───
export const agentTemplates = mysqlTable("agent_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).default("general"),
  functionId: int("function_id"),
  soulTemplateId: int("soul_template_id"),
  hierarchyRole: varchar("hierarchy_role", { length: 30 }).default("worker"),
  modelProvider: varchar("model_provider", { length: 50 }).default("openai"),
  modelName: varchar("model_name", { length: 100 }).default("gpt-4o"),
  systemPrompt: text("system_prompt"),
  temperature: int("temperature").default(70),
  maxTokens: int("max_tokens").default(2048),
  isPublic: boolean("is_public").default(true),
  isActive: boolean("is_active").default(true),
  usageCount: int("usage_count").default(0),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Agent Function Templates (predefined roles with skills) ───
export const agentFunctions = mysqlTable("agent_functions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  skills: json("skills"), // array of skill strings (legacy, kept for compatibility)
  recommendedPrompt: text("recommended_prompt"),
  recommendedProvider: varchar("recommended_provider", { length: 50 }),
  recommendedModel: varchar("recommended_model", { length: 100 }),
  hierarchyRole: varchar("hierarchy_role", { length: 30 }).default("worker"),
  // ─── New catalog fields ───
  industry: varchar("industry", { length: 100 }),
  category: varchar("category", { length: 50 }),
  complexityLevel: int("complexity_level", { unsigned: true }).default(1),
  typicalTools: json("typical_tools").$type<string[]>().default([]),
  inputTypes: json("input_types").$type<string[]>().default([]),
  outputTypes: json("output_types").$type<string[]>().default([]),
  useCases: json("use_cases").$type<string[]>().default([]),
  prerequisites: json("prerequisites").$type<string[]>().default([]),
  tags: json("tags").$type<string[]>().default([]),
  popularityScore: int("popularity_score", { unsigned: true }).default(0),
  verified: boolean("verified").default(false),
  isDefault: boolean("is_default").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Soul Templates (default personalities) ───
export const soulTemplates = mysqlTable("soul_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).default("general"),
  isDefault: boolean("is_default").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Agent Souls (copies tied to specific agents) ───
export const agentSouls = mysqlTable("agent_souls", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agent_id").notNull(),
  templateId: int("template_id"),
  name: varchar("name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Agent Teams ───
export const agentTeams = mysqlTable("agent_teams", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  orchestratorAgentId: int("orchestrator_agent_id").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Agent Team Members ───
export const agentTeamMembers = mysqlTable("agent_team_members", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("team_id").notNull(),
  agentId: int("agent_id").notNull(),
  role: varchar("role", { length: 30 }).default("worker"), // worker, reviewer, specialist
  orderIndex: int("order_index").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Agent Logs (stack-scoped) ───
export const agentLogs = mysqlTable("agent_logs", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  agentId: int("agent_id").notNull(),
  level: varchar("level", { length: 20 }).default("info"),
  message: text("message").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Agent Outputs (file storage for completed work) ───
export const agentOutputs = mysqlTable("agent_outputs", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  agentId: int("agent_id"),
  workflowRunId: int("workflow_run_id"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  contentType: varchar("content_type", { length: 50 }).default("text"),
  content: text("content").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).default("text/plain"),
  sizeBytes: int("size_bytes"),
  tags: json("tags"),
  source: varchar("source", { length: 50 }).default("workflow"),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Skills Taxonomy ───
export const skills = mysqlTable("skills", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(), // technical | soft | domain | tool
  subcategory: varchar("subcategory", { length: 100 }),
  difficulty: int("difficulty", { unsigned: true }).default(1), // 1-5
  prerequisites: json("prerequisites").$type<string[]>().default([]), // array of skill slugs
  relatedSkills: json("related_skills").$type<string[]>().default([]), // array of skill slugs
  popularity: int("popularity", { unsigned: true }).default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Agent Function ↔ Skills Join Table ───
export const agentFunctionSkills = mysqlTable("agent_function_skills", {
  id: int("id").autoincrement().primaryKey(),
  agentFunctionId: int("agent_function_id").notNull(),
  skillId: int("skill_id").notNull(),
  proficiencyLevel: int("proficiency_level", { unsigned: true }).default(3), // 1-5
  isRequired: boolean("is_required").default(true),
});

// ─── Stack Blueprints (pre-built stack configurations) ───
export const stackBlueprints = mysqlTable("stack_blueprints", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  industry: varchar("industry", { length: 100 }),
  category: varchar("category", { length: 50 }),
  complexityLevel: int("complexity_level", { unsigned: true }).default(1), // 1-5
  agentConfigs: json("agent_configs").$type<
    Array<{
      agentFunctionSlug: string;
      name?: string;
      hierarchyRole?: string;
      modelProvider?: string;
      modelName?: string;
      temperature?: number;
      maxTokens?: number;
      systemPromptOverride?: string;
    }>
  >().notNull(),
  workflowTemplateId: int("workflow_template_id"),
  requiredIntegrations: json("required_integrations").$type<string[]>().default([]),
  setupInstructions: text("setup_instructions"),
  estimatedMonthlyCost: json("estimated_monthly_cost").$type<Record<string, number>>().default({}),
  isPremium: boolean("is_premium").default(false),
  isActive: boolean("is_active").default(true),
  usageCount: int("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
