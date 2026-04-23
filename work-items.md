# Kimi 2.6 Swarm — Multi-Stack SaaS Architecture

> **Context**: The current app is a single-instance AI Agent orchestrator. One login → one set of agents, workflows, inputs, and analytics. The goal is to convert it into a **multi-stack SaaS platform** where one login → a **Dashboard of Stacks**, each stack being a fully isolated AI Agent environment (own agents, workflows, credentials, inputs, analytics). A **global chat widget** on the dashboard acts as an inbuilt input channel to any stack's orchestrator.
>
> **Tech Stack**: React 19 + Vite + tRPC 11 + Hono + Drizzle ORM + MySQL + Docker Compose + Tailwind CSS
>
> **Server**: Ubuntu 24.04 droplet, Docker Compose deployment, `scripts/deploy.sh` preserves `.env`
>
> **DB**: MySQL 8.0 via Docker. Schema auto-initializes from `db/init/01-schema.sql` on first boot.

---

## Guiding Principles

1. **True Isolation**: Every table that contains stack data gets a `stackId` column. All queries filter by `stackId`.
2. **Backwards Compatibility**: Existing single-instance users get auto-migrated into a "Default Stack" on first boot. No data loss.
3. **URL Structure**: All stack-scoped pages live under `/stacks/:stackId/*`. The post-login landing is `/dashboard` (stacks list).
4. **No Magic**: Explicit `stackId` passing. No implicit context that makes testing hard.
5. **Minimal Changes**: Reuse existing components. Wrap them in stack-aware containers rather than rewriting.

---

## Work Item 1: Multi-Stack Data Model & DB Migration

### Goal
Create the `stacks` and `stackMembers` tables. Add `stackId` to all existing data tables. Write a migration that creates a default stack for every existing user and assigns all their data to it.

### Files to Modify
- `db/schema.ts` — add new tables, add `stackId` columns
- `db/init/01-schema.sql` — mirror schema.ts for fresh installs
- `api/middleware.ts` — add `getCurrentStackId()` helper (reads from header/context)
- `api/queries/connection.ts` — ensure migration runs

### Detailed Steps

#### 1.1 Schema Changes in `db/schema.ts`

```ts
// New: stacks table
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

// New: stackMembers table (many-to-many with roles)
export const stackMembers = mysqlTable("stack_members", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  userId: int("user_id").notNull(),
  role: varchar("role", { length: 20 }).default("member"), // owner, admin, member
  invitedBy: int("invited_by"),
  joinedAt: timestamp("joined_at").defaultNow(),
});
```

Add `stackId` to ALL existing data tables:
- `aiAgents.stackId: int("stack_id").notNull()`
- `apiKeys.stackId: int("stack_id").notNull()`
- `workflowNodes.stackId: int("stack_id").notNull()`
- `workflowEdges.stackId: int("stack_id").notNull()`
- `inputSources.stackId: int("stack_id").notNull()`
- `conversations.stackId: int("stack_id").notNull()`
- `agentLogs.stackId: int("stack_id").notNull()`

> **IMPORTANT**: Do NOT add `stackId` to `users` table. Users are global.

#### 1.2 Mirror in `db/init/01-schema.sql`

Rewrite the init SQL to include the new tables and `stack_id` columns. For fresh installs, this is the source of truth.

#### 1.3 Migration Strategy

In `api/boot.ts` (or a new `api/migrations/001-default-stack.ts`), run on startup:

```ts
// Pseudocode — implement as actual migration
async function migrateToMultiStack() {
  const db = getDb();
  // Check if stacks table is empty
  const existingStacks = await db.select().from(stacks).limit(1);
  if (existingStacks.length > 0) return; // Already migrated

  // For every user, create a default stack
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    const [stack] = await db.insert(stacks).values({
      name: `${user.name || user.email}'s Stack`,
      slug: `default-${user.id}`,
      ownerId: user.id,
      isDefault: true,
      status: "active",
    });
    const stackId = stack.insertId;

    // Add user as owner member
    await db.insert(stackMembers).values({ stackId, userId: user.id, role: "owner" });

    // Move all their data to this stack
    await db.update(aiAgents).set({ stackId }).where(eq(aiAgents.id, ???)); // NEEDS FIX: no user_id on aiAgents
  }
}
```

**PROBLEM**: `aiAgents` does not have `userId`. How do we know which agents belong to which user?

**SOLUTION**: The current app is single-user-per-instance in practice (no `user_id` on agents). For migration, assume ALL existing data belongs to the first admin user, or add `createdBy` to `aiAgents` now and set it during migration.

**RECOMMENDED FIX**: Add `createdBy: int("created_by")` to `aiAgents` (and all other data tables) as part of this migration. For existing rows, set `createdBy = 1` (first user). Then migration can group by `createdBy`.

Actually, simpler: since the current deployment has only one user (`murphy@askq.co.nz`), just assign everything to user ID 1. Create one default stack, update all rows.

```ts
await db.update(aiAgents).set({ stackId: defaultStackId });
await db.update(apiKeys).set({ stackId: defaultStackId });
await db.update(workflowNodes).set({ stackId: defaultStackId });
await db.update(workflowEdges).set({ stackId: defaultStackId });
await db.update(inputSources).set({ stackId: defaultStackId });
await db.update(conversations).set({ stackId: defaultStackId });
await db.update(agentLogs).set({ stackId: defaultStackId });
```

> **CRITICAL**: This migration must be idempotent. Wrap in a transaction. Check `stacks` table existence/count before running.

---

## Work Item 2: Stack Management API (tRPC Routers)

### Goal
Create tRPC routers for stack CRUD, membership management, and stack switching.

### Files to Create/Modify
- `api/stack-router.ts` — new file
- `api/middleware.ts` — ensure auth context has user info
- `api/_app.ts` — register stack router

### Detailed Steps

#### 2.1 Stack Router (`api/stack-router.ts`)

```ts
export const stackRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    // Return all stacks where user is a member
    const memberStacks = await db
      .select()
      .from(stackMembers)
      .where(eq(stackMembers.userId, ctx.user.id));
    const stackIds = memberStacks.map((m) => m.stackId);
    if (stackIds.length === 0) return [];
    return db.select().from(stacks).where(inArray(stacks.id, stackIds));
  }),

  getById: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Verify membership
      await verifyStackAccess(ctx.user.id, input.stackId);
      const [stack] = await db.select().from(stacks).where(eq(stacks.id, input.stackId));
      if (!stack) throw new TRPCError({ code: "NOT_FOUND" });
      return stack;
    }),

  create: authedQuery
    .input(z.object({ name: z.string().min(1).max(100), description: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
      const [result] = await db.insert(stacks).values({
        name: input.name,
        description: input.description,
        slug,
        ownerId: ctx.user.id,
      });
      const stackId = result.insertId;
      await db.insert(stackMembers).values({ stackId, userId: ctx.user.id, role: "owner" });
      return { id: stackId, slug };
    }),

  update: authedQuery
    .input(z.object({ stackId: z.number(), name: z.string().min(1).optional(), description: z.string().optional(), status: z.enum(["active", "archived"]).optional() }))
    .mutation(async ({ input, ctx }) => {
      await verifyStackAccess(ctx.user.id, input.stackId, ["owner", "admin"]);
      await db.update(stacks).set({ ...input, updatedAt: new Date() }).where(eq(stacks.id, input.stackId));
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ stackId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await verifyStackAccess(ctx.user.id, input.stackId, ["owner"]);
      // Soft delete: mark as suspended, or hard delete? RECOMMEND: hard delete with CASCADE.
      await db.delete(stacks).where(eq(stacks.id, input.stackId));
      return { success: true };
    }),

  // Members
  getMembers: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ input, ctx }) => {
      await verifyStackAccess(ctx.user.id, input.stackId);
      return db.select().from(stackMembers).where(eq(stackMembers.stackId, input.stackId));
    }),

  inviteMember: authedQuery
    .input(z.object({ stackId: z.number(), email: z.string().email(), role: z.enum(["admin", "member"]).default("member") }))
    .mutation(async ({ input, ctx }) => {
      await verifyStackAccess(ctx.user.id, input.stackId, ["owner", "admin"]);
      // Find user by email
      const [targetUser] = await db.select().from(users).where(eq(users.email, input.email));
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      // Check if already member
      const existing = await db.select().from(stackMembers).where(and(eq(stackMembers.stackId, input.stackId), eq(stackMembers.userId, targetUser.id)));
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Already a member" });
      await db.insert(stackMembers).values({ stackId: input.stackId, userId: targetUser.id, role: input.role, invitedBy: ctx.user.id });
      return { success: true };
    }),

  removeMember: authedQuery
    .input(z.object({ stackId: z.number(), userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await verifyStackAccess(ctx.user.id, input.stackId, ["owner", "admin"]);
      // Cannot remove owner
      const [member] = await db.select().from(stackMembers).where(and(eq(stackMembers.stackId, input.stackId), eq(stackMembers.userId, input.userId)));
      if (member?.role === "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove owner" });
      await db.delete(stackMembers).where(and(eq(stackMembers.stackId, input.stackId), eq(stackMembers.userId, input.userId)));
      return { success: true };
    }),
});
```

#### 2.2 Auth Middleware Helper

Add `verifyStackAccess(userId, stackId, allowedRoles?)` to `api/middleware.ts` or a new `api/lib/permissions.ts`.

```ts
export async function verifyStackAccess(userId: number, stackId: number, allowedRoles = ["owner", "admin", "member"]) {
  const db = getDb();
  const [membership] = await db.select().from(stackMembers).where(and(eq(stackMembers.userId, userId), eq(stackMembers.stackId, stackId)));
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied for this stack" });
  }
  return membership;
}
```

#### 2.3 Context Enhancement

Ensure the tRPC context (`createContext` in `api/middleware.ts`) includes the authenticated user. The current `publicQuery` doesn't enforce auth. You need an `authedQuery` middleware:

```ts
const authedQuery = publicQuery.use(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

If the current auth context doesn't include user, extend it. The JWT middleware should decode the token and add `ctx.user`.

---

## Work Item 3: Stack Isolation Middleware — Audit ALL Existing Routers

### Goal
Every existing tRPC router must enforce `stackId` filtering on ALL database queries. No router should return data from multiple stacks.

### Files to Modify
- `api/agent-router.ts` — add `stackId` to all queries/mutations
- `api/execution-router.ts` — add `stackId` to all queries/mutations
- `api/webhook-router.ts` — add `stackId` to all queries
- `api/settings-router.ts` — add `stackId` to all queries/mutations
- `api/analytics-router.ts` — add `stackId` filter
- Any other router files in `api/`

### Detailed Steps

#### 3.1 Pattern for Router Updates

For every router procedure that queries data:

1. **Add `stackId` to input schema** (if client-provided) OR **read from context** (if server-managed).
2. **Filter every DB query** with `.where(eq(table.stackId, stackId))`.
3. **Verify membership** before returning data.

Example for `agent-router.ts`:

```ts
// BEFORE
list: publicQuery.query(async () => {
  const db = getDb();
  return db.select().from(aiAgents).orderBy(desc(aiAgents.createdAt));
})

// AFTER
list: authedQuery
  .input(z.object({ stackId: z.number() }))
  .query(async ({ input, ctx }) => {
    await verifyStackAccess(ctx.user.id, input.stackId);
    return db.select().from(aiAgents).where(eq(aiAgents.stackId, input.stackId)).orderBy(desc(aiAgents.createdAt));
  })
```

#### 3.2 Execution Router Special Handling

The `executeWorkflow` mutation currently loads all workflow nodes/edges from DB if not provided. It MUST filter by `stackId`:

```ts
if (!nodes || !edges) {
  const [dbNodes, dbEdges] = await Promise.all([
    db.select().from(workflowNodes).where(and(eq(workflowNodes.isActive, true), eq(workflowNodes.stackId, stackId))),
    db.select().from(workflowEdges).where(and(eq(workflowEdges.isActive, true), eq(workflowEdges.stackId, stackId))),
  ]);
  // ...
}
```

#### 3.3 Webhook Router

Webhooks don't have an authenticated user context (they're called by external services). The `sourceId` in `inputSources` maps to a `stackId`. Use that:

```ts
receive: publicQuery
  .input(z.object({ sourceType: z.string(), sourceId: z.number(), payload: z.record(z.any()) }))
  .query(async ({ input }) => {
    const db = getDb();
    const [source] = await db.select().from(inputSources).where(eq(inputSources.id, input.sourceId));
    if (!source) return { success: false, error: "Source not found" };
    const stackId = source.stackId;
    // ... rest of webhook handling, all queries filtered by stackId
  })
```

> **CRITICAL**: The webhook router's `getAgentForInput` must also respect `stackId`.

---

## Work Item 4: Global Dashboard (Stacks List) — Post-Login Landing

### Goal
Replace the current `/dashboard` (analytics view) with a **Stacks Dashboard** that shows all stacks the user has access to, allows creating new stacks, and provides a global chat widget.

### Files to Create/Modify
- `src/pages/Dashboard.tsx` — COMPLETE REWRITE
- `src/App.tsx` — update routing
- `src/components/layout/AppLayout.tsx` — update nav for stack context

### Detailed Steps

#### 4.1 Dashboard Page Design

The new Dashboard (`/dashboard`) should show:

**Header Section:**
- "Your AI Agent Stacks" title
- "Create Stack" button (opens modal)
- User avatar + logout

**Stacks Grid:**
- Card per stack showing:
  - Stack name + description
  - Status badge (active/archived)
  - Role badge (owner/admin/member)
  - Agent count (fetch from `trpc.stack.getStats` or compute client-side)
  - Last activity timestamp
  - "Open Stack" button → navigates to `/stacks/:stackId/architecture`
  - "Chat" button → opens the global chat widget targeting this stack

**Create Stack Modal:**
- Name (required)
- Description (optional)
- "Create" button → calls `trpc.stack.create`
- On success, invalidate list and navigate to new stack

#### 4.2 Component Structure

```tsx
// src/pages/Dashboard.tsx
export default function Dashboard() {
  const { data: stacks, isLoading } = trpc.stack.list.useQuery();
  const createMutation = trpc.stack.create.useMutation();
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (isLoading) return <SkeletonGrid />;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <DashboardHeader onCreate={() => setShowCreateModal(true)} />
      {stacks?.length === 0 ? <EmptyState /> : <StacksGrid stacks={stacks} />}
      {showCreateModal && <CreateStackModal onClose={...} onCreate={...} />}
      <GlobalChatWidget />
    </div>
  );
}
```

#### 4.3 Routing Changes in `src/App.tsx`

```tsx
// BEFORE
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/agents" element={<Agents />} />
<Route path="/architecture" element={<Architecture />} />
<Route path="/analytics" element={<Analytics />} />
<Route path="/settings" element={<Settings />} />

// AFTER
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/stacks/:stackId" element={<StackLayout />}>
  <Route path="agents" element={<Agents />} />
  <Route path="architecture" element={<Architecture />} />
  <Route path="analytics" element={<Analytics />} />
  <Route path="settings" element={<Settings />} />
</Route>
<Route path="/guide" element={<SetupGuide />} />
<Route path="/user/settings" element={<UserSettings />} />
```

> **IMPORTANT**: `StackLayout` is a wrapper that:
> 1. Validates the user has access to `:stackId`
> 2. Provides `stackId` via React Context to all child routes
> 3. Shows a stack switcher in the header

#### 4.4 StackLayout Component

```tsx
// src/components/layout/StackLayout.tsx
export const StackContext = createContext<{ stackId: number } | null>(null);

export function useStack() {
  const ctx = useContext(StackContext);
  if (!ctx) throw new Error("useStack must be used within StackLayout");
  return ctx;
}

export default function StackLayout() {
  const { stackId } = useParams<{ stackId: string }>();
  const id = parseInt(stackId!);
  const { data: stack, isLoading } = trpc.stack.getById.useQuery({ stackId: id });
  
  if (isLoading) return <LoadingScreen />;
  if (!stack) return <Navigate to="/dashboard" />;

  return (
    <StackContext.Provider value={{ stackId: id }}>
      <AppLayout stack={stack}>
        <Outlet />
      </AppLayout>
    </StackContext.Provider>
  );
}
```

#### 4.5 Update AppLayout Navigation

The sidebar/top nav in `AppLayout` should:
- Show the current stack name
- Have a "← Back to Dashboard" link
- Show stack-scoped nav items: Architecture, Agents, Analytics, Settings
- Show global items: Guide, User Settings

---

## Work Item 5: Global Chat Widget (Inbuilt Input Channel)

### Goal
A floating chat widget on the Dashboard that lets users send messages to ANY stack's orchestrator agent and receive responses. This acts as an "inbuilt input channel" — no Telegram/Slack/Discord needed to interact with a stack.

### Files to Create/Modify
- `src/components/GlobalChatWidget.tsx` — new component
- `src/pages/Dashboard.tsx` — include the widget
- `api/execution-router.ts` — add `orchestratorChat` mutation

### Detailed Steps

#### 5.1 Global Chat Widget UI

```tsx
// Floating bottom-right chat panel (like Intercom/Drift)
// States: minimized (circle button) → expanded (chat panel)

interface GlobalChatWidgetProps {
  // No props needed — fetches user's stacks internally
}

// Features:
// - Stack selector dropdown (all user's stacks)
// - Message input
// - Message history (stored in localStorage per stack, or fetched from DB)
// - "Send" button triggers orchestratorChat mutation
// - Typing indicator while loading
// - Error display
```

**Design specs:**
- Minimized: 48px circle button with `<MessageSquare />` icon, fixed bottom-right, z-50
- Expanded: 380px × 500px panel, fixed bottom-right, rounded-xl, glassmorphism background
- Header: Stack selector (dropdown) + minimize button
- Messages: User messages right-aligned (blue bubble), assistant left-aligned (dark bubble)
- Input: Textarea at bottom, auto-resize, Cmd+Enter to send

#### 5.2 Orchestrator Chat API

Add to `api/execution-router.ts`:

```ts
orchestratorChat: authedQuery
  .input(z.object({
    stackId: z.number(),
    message: z.string().min(1),
    conversationHistory: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    await verifyStackAccess(ctx.user.id, input.stackId);
    const db = getDb();

    // Find the orchestrator agent for this stack
    const [orchestrator] = await db
      .select()
      .from(aiAgents)
      .where(and(
        eq(aiAgents.stackId, input.stackId),
        eq(aiAgents.hierarchyRole, "orchestrator"),
        eq(aiAgents.isEnabled, true)
      ))
      .limit(1);

    if (!orchestrator) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No orchestrator agent found in this stack. Create one in the Architecture page." });
    }

    // Route to the orchestrator agent (reuse existing chat logic)
    const result = await routeToAgent(orchestrator.id, input.message); // or inline the provider call

    // Save conversation
    await db.insert(conversations).values([
      { stackId: input.stackId, agentId: orchestrator.id, role: "user", content: input.message },
      { stackId: input.stackId, agentId: orchestrator.id, role: "assistant", content: result },
    ]);

    return { response: result, agentName: orchestrator.name };
  }),
```

> **NOTE**: If a stack has no orchestrator agent, return a helpful error telling the user to create one.

#### 5.3 Message History

For simplicity, store conversation history in `localStorage` keyed by `global-chat:${stackId}`. On component mount, load from localStorage. On send, append both user and assistant messages.

> **Future enhancement**: Persist to DB with a `globalConversations` table. Out of scope for initial implementation.

---

## Work Item 6: Stack-Aware UI — Update ALL Pages to Use Stack Context

### Goal
Every existing page (Agents, Architecture, Analytics, Settings) must be updated to:
1. Read `stackId` from `StackContext` (or URL params)
2. Pass `stackId` to ALL tRPC queries/mutations
3. Filter displayed data by the current stack

### Files to Modify
- `src/pages/Agents.tsx`
- `src/pages/Architecture.tsx`
- `src/pages/Analytics.tsx`
- `src/pages/Settings.tsx`
- `src/pages/SetupGuide.tsx` (global, no changes needed)

### Detailed Steps

#### 6.1 Pattern for Page Updates

Every page should use the `useStack()` hook:

```tsx
import { useStack } from "@/components/layout/StackLayout";

export default function Agents() {
  const { stackId } = useStack();
  const { data: agents } = trpc.agent.list.useQuery({ stackId });
  const createMutation = trpc.agent.create.useMutation({
    onSuccess: () => utils.agent.list.invalidate({ stackId }),
  });

  // All mutations must include stackId in their input
  const handleCreate = (data) => {
    createMutation.mutate({ ...data, stackId });
  };

  // ... rest of component
}
```

#### 6.2 Architecture Page Special Handling

The Architecture page uses `flowStore.ts` (Zustand) for ReactFlow state. The store itself is client-side only and doesn't need `stackId`. However, when saving/loading workflows to/from the DB, `stackId` must be included.

Currently, the Architecture page saves workflows via tRPC. Ensure the save mutation includes `stackId`:

```ts
// In Architecture.tsx
const saveWorkflow = trpc.workflow.save.useMutation();
// When saving:
saveWorkflow.mutate({ stackId, nodes, edges });
```

If workflow save/load routers don't exist yet, they need to be created (or use the existing `workflowNodes`/`workflowEdges` tables directly via tRPC).

#### 6.3 Settings Page Split

Current Settings page mixes global settings (API keys, user profile) with what should be stack-scoped settings.

**Split into two pages:**
1. **Stack Settings** (`/stacks/:stackId/settings`): Stack name, description, members, stack-specific API keys
2. **User Settings** (`/user/settings`): Profile, password, global preferences

For the initial implementation:
- Move API keys to stack-scoped settings (each stack has its own API keys)
- Keep user profile in global settings
- Add "Members" section to stack settings

---

## Work Item 7: Stack-Level Analytics & Monitoring

### Goal
The Analytics page currently shows global metrics. It must be updated to show metrics for the **current stack only**. The Dashboard (stacks list) should show **summary stats** for each stack (total messages, agent count, status).

### Files to Modify
- `api/execution-router.ts` — `getAnalytics` must accept `stackId`
- `src/pages/Analytics.tsx` — pass `stackId` to analytics query
- `src/pages/Dashboard.tsx` — show mini stats on stack cards

### Detailed Steps

#### 7.1 Stack-Scoped Analytics API

```ts
getAnalytics: authedQuery
  .input(z.object({ stackId: z.number() }))
  .query(async ({ input, ctx }) => {
    await verifyStackAccess(ctx.user.id, input.stackId);
    const db = getDb();
    // All queries now filter by stackId
    const allConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.stackId, input.stackId))
      .orderBy(desc(conversations.createdAt));
    // ... rest of analytics logic
  })
```

#### 7.2 Dashboard Stack Cards

Each stack card should show:
- Agent count
- Total messages (last 30 days)
- Stack status
- Plan badge (free/pro)

Either compute these on the backend in `stack.list` (with a join/subquery) or add a `trpc.stack.getStats({ stackId })` query.

---

## Work Item 8: URL Redirects & Backwards Compatibility

### Goal
Ensure existing bookmarks and URLs don't break. Implement redirects from old URLs to new stack-scoped URLs.

### Files to Modify
- `src/App.tsx` — add redirect routes

### Detailed Steps

```tsx
// In App.tsx, add redirect routes BEFORE the main routes
<Route path="/agents" element={<LegacyRedirect to="/stacks/:stackId/agents" />} />
<Route path="/architecture" element={<LegacyRedirect to="/stacks/:stackId/architecture" />} />
<Route path="/analytics" element={<LegacyRedirect to="/stacks/:stackId/analytics" />} />
<Route path="/settings" element={<LegacyRedirect to="/stacks/:stackId/settings" />} />

// LegacyRedirect component:
function LegacyRedirect({ to }: { to: string }) {
  const lastStackId = localStorage.getItem("lastStackId");
  if (lastStackId) {
    return <Navigate to={to.replace(":stackId", lastStackId)} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}
```

Also, whenever a user navigates to a stack-scoped page, store `lastStackId` in localStorage:

```tsx
// In StackLayout
useEffect(() => {
  localStorage.setItem("lastStackId", String(id));
}, [id]);
```

---

## Work Item 9: DB Schema Init & Docker Compose

### Goal
Ensure the new schema works with fresh installs and the migration works for existing installs.

### Files to Modify
- `db/init/01-schema.sql` — full schema with new tables and `stack_id` columns
- `docker-compose.yml` — no changes needed unless adding new services

### Detailed Steps

#### 9.1 Schema SQL

Rewrite `db/init/01-schema.sql` to include:
1. `stacks` table
2. `stack_members` table
3. All existing tables with `stack_id` columns
4. Indexes on `stack_id` for performance

Example index additions:
```sql
CREATE INDEX idx_agents_stack ON ai_agents(stack_id);
CREATE INDEX idx_api_keys_stack ON api_keys(stack_id);
CREATE INDEX idx_conversations_stack ON conversations(stack_id);
CREATE INDEX idx_logs_stack ON agent_logs(stack_id);
CREATE INDEX idx_nodes_stack ON workflow_nodes(stack_id);
CREATE INDEX idx_edges_stack ON workflow_edges(stack_id);
CREATE INDEX idx_inputs_stack ON input_sources(stack_id);
CREATE INDEX idx_members_stack ON stack_members(stack_id);
CREATE INDEX idx_members_user ON stack_members(user_id);
```

#### 9.2 Migration Order

The migration (Work Item 1) should run:
1. AFTER the schema is updated (tables exist)
2. BEFORE the app starts accepting requests
3. Only once (idempotent check)

Place the migration call in `api/boot.ts` before starting the Hono server:

```ts
async function boot() {
  await runMigrations(); // Work Item 1
  const app = createApp();
  // ...
}
```

---

## Work Item 10: Testing & Validation Checklist

### Goal
Before declaring the multi-stack architecture complete, validate:

1. **Fresh Install**: Docker Compose up on a clean machine → schema initializes → default stack created for first user → all pages work.
2. **Existing Install**: Deploy to existing server → migration runs → all existing data assigned to default stack → no data loss → all pages work.
3. **Stack Creation**: User creates new stack → stack appears in dashboard → can navigate to it → can add agents/workflows → data is isolated from other stacks.
4. **Isolation**: Agent created in Stack A does not appear in Stack B. Analytics for Stack A don't include Stack B data.
5. **Global Chat**: Chat widget on dashboard → select Stack A → send message → orchestrator responds → select Stack B → different context.
6. **Permissions**: Non-owner cannot delete stack. Member cannot invite users. Admin can invite but not delete.
7. **Webhooks**: External webhook to Stack A's input source routes to Stack A's agent only.

---

## Appendix A: File Inventory

### New Files (to create)
- `api/stack-router.ts`
- `api/lib/permissions.ts`
- `src/components/layout/StackLayout.tsx`
- `src/components/GlobalChatWidget.tsx`
- `src/pages/UserSettings.tsx`
- `api/migrations/001-default-stack.ts`

### Modified Files (to update)
- `db/schema.ts`
- `db/init/01-schema.sql`
- `api/middleware.ts` — add authedQuery, verifyStackAccess
- `api/_app.ts` — register stack router
- `api/agent-router.ts` — add stackId to all procedures
- `api/execution-router.ts` — add stackId + orchestratorChat
- `api/webhook-router.ts` — add stackId filtering
- `api/settings-router.ts` — split global/stack settings
- `src/App.tsx` — new routing structure
- `src/pages/Dashboard.tsx` — complete rewrite
- `src/pages/Agents.tsx` — add useStack
- `src/pages/Architecture.tsx` — add useStack
- `src/pages/Analytics.tsx` — add useStack
- `src/pages/Settings.tsx` — split into stack settings
- `src/components/layout/AppLayout.tsx` — stack-aware nav

---

## Appendix B: Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        DASHBOARD (/dashboard)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Stack Card A │  │ Stack Card B │  │   Global Chat Widget │  │
│  │ [Open] [Chat]│  │ [Open] [Chat]│  │  [Stack A ▼]        │  │
│  └─────────────┘  └─────────────┘  │  User: Hello!        │  │
│                                     │  Bot: Hi!            │  │
│                                     └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │ Stack A     │   │ Stack B     │   │ Stack C     │
   │ /stacks/1/* │   │ /stacks/2/* │   │ /stacks/3/* │
   │             │   │             │   │             │
   │ Agents      │   │ Agents      │   │ Agents      │
   │ Workflows   │   │ Workflows   │   │ Workflows   │
   │ Inputs      │   │ Inputs      │   │ Inputs      │
   │ Analytics   │   │ Analytics   │   │ Analytics   │
   │ Settings    │   │ Settings    │   │ Settings    │
   └─────────────┘   └─────────────┘   └─────────────┘
```

---

## Appendix C: Common Pitfalls

1. **Forgetting stackId in a query**: Every SELECT, INSERT, UPDATE must include `stackId`. Search for `.from(` in all router files and audit each one.
2. **Webhook security**: Webhooks don't have auth cookies. Always look up the `sourceId` → `stackId` mapping and verify the source exists before routing.
3. **Zustand store scope**: `flowStore.ts` is global in the browser. That's fine — the canvas state is per-page. Don't try to make it stack-aware unless necessary.
4. **LocalStorage lastStackId**: This is a UX convenience, not a security mechanism. Always verify server-side that the user has access to the requested `stackId`.
5. **Migration idempotency**: If the migration runs twice, it must not create duplicate default stacks. Check `stacks` table count first.
6. **URL param vs context**: Pages should read `stackId` from `useStack()` context, not parse URL params themselves. This ensures consistency.
