import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  boolean,
  json,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

// ─── Users (global, not stack-scoped) ───
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
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
  status: varchar("status", { length: 20 }).default("active"), // active, archived, suspended
  plan: varchar("plan", { length: 20 }).default("free"), // free, pro, enterprise
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Stack Members (many-to-many with roles) ───
export const stackMembers = mysqlTable("stack_members", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  userId: int("user_id").notNull(),
  role: varchar("role", { length: 20 }).default("member"), // owner, admin, member
  invitedBy: int("invited_by"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// ─── AI Agents (stack-scoped) ───
export const aiAgents = mysqlTable("ai_agents", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt"),
  hierarchyRole: varchar("hierarchy_role", { length: 30 }).default("worker"), // orchestrator, manager, worker
  modelProvider: varchar("model_provider", { length: 50 }).default("openai"), // openai, anthropic, google
  modelName: varchar("model_name", { length: 100 }).default("gpt-4o"),
  temperature: int("temperature").default(70), // stored as 0-200, divide by 100
  maxTokens: int("max_tokens").default(2048),
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
  provider: varchar("provider", { length: 50 }).notNull(), // openai, anthropic, google
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
  type: varchar("type", { length: 50 }).notNull(), // agent, trigger, condition, action
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
  type: varchar("type", { length: 50 }).notNull(), // webhook, telegram, slack, discord, email
  config: json("config"),
  isActive: boolean("is_active").default(true),
  targetAgentId: int("target_agent_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Conversations (stack-scoped) ───
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  agentId: int("agent_id").notNull(),
  role: varchar("role", { length: 20 }).notNull(), // user, assistant, system
  content: text("content").notNull(),
  source: varchar("source", { length: 50 }).default("web"), // web, telegram, slack, discord, webhook
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

// ─── Agent Logs (stack-scoped) ───
export const agentLogs = mysqlTable("agent_logs", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  agentId: int("agent_id").notNull(),
  level: varchar("level", { length: 20 }).default("info"), // debug, info, warn, error
  message: text("message").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});
