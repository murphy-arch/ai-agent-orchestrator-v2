# Milestone Plan: Integration Fixes for AI Agent Orchestrator v2.0.0

## Goal
Fix all broken end-to-end flows so the app is **fully integratable** — every button in the UI successfully talks to the backend, data is persisted correctly, and security is sound.

---

## Milestone 1: Secure API Keys (P0 — Security)
**Objective:** API keys must be encrypted at rest and only visible after master-password verification.

### Tasks
1. **Update `db/schema.ts`**
   - Add `masterPassword` table (if not already present from old migration)
   - Verify `apiKeys` schema matches what `settings-router.ts` expects

2. **Rewrite `api/settings-router.ts`**
   - Import `encrypt` / `decrypt` from `./lib/crypto`
   - `addApiKey`: encrypt `keyValue` before insert
   - `getStackSettings`: return keys **without** `keyValue`
   - Add `verifyMasterPassword` mutation
   - Add `listApiKeysDecrypted` query (requires master password, returns decrypted values)
   - Add `getApiKeyValue` query (requires master password, returns single decrypted value)

3. **Update `src/pages/Settings.tsx`**
   - Add master-password modal state
   - On page load: API keys show label/provider only, values masked
   - "Reveal" button per key → prompts master password → calls `listApiKeysDecrypted`
   - Copy button only works after master password is verified
   - Add "Set Master Password" UI if not set

4. **Cleanup**
   - Delete `api/apikeys-router.ts` (logic merged)
   - Remove unused `master_password` old-table references if any

### Success Criteria
- [ ] Creating an API key stores encrypted value in DB
- [ ] Settings page shows masked values by default
- [ ] Master password required to view or copy key values
- [ ] Old `apikeys-router.ts` removed, no orphaned code

---

## Milestone 2: Agent Credential Linking (P1 — Broken Feature)
**Objective:** Agents can be assigned API keys/credentials, and the system validates them.

### Tasks
1. **Add `agentCredentials` to `db/schema.ts`**
   ```ts
   export const agentCredentials = mysqlTable("agent_api_credentials", {
     id: int("id").autoincrement().primaryKey(),
     agentId: int("agent_id").notNull(),
     credentialType: varchar("credential_type", { length: 50 }).notNull(), // openai, anthropic, etc.
     apiKeyId: int("api_key_id"), // references apiKeys.id
     endpointOverride: varchar("endpoint_override", { length: 500 }),
     modelOverride: varchar("model_override", { length: 100 }),
     additionalConfig: text("additional_config"),
     isActive: boolean("is_active").default(true),
     createdAt: timestamp("created_at").defaultNow(),
   });
   ```

2. **Wire `agent-credentials-router.ts` into `_app.ts`**
   - OR merge its routes into `agent-router.ts` under a `credentials` sub-router
   - Fix imports: use `@db/connection` and `@db/schema`
   - Update to use `authedQuery` + `verifyStackAccess`

3. **Update `src/pages/Agents.tsx` edit modal**
   - Add "Credentials" section in agent edit form
   - Dropdown to select linked API key (from stack's apiKeys)
   - Optional: endpoint override, model override fields

4. **Update `agent-router.ts` create/update**
   - Optionally accept `apiKeyId` in create/update payload
   - On create, if `apiKeyId` provided, create `agentCredentials` row

### Success Criteria
- [ ] Can assign an API key to an agent during creation or edit
- [ ] `agentCredentials` table populated correctly
- [ ] Agent list shows which credential is linked (if any)

---

## Milestone 3: Auth Polish & Logout (P1 — UX)
**Objective:** Auth feels like a modern SPA, not a page-reload form.

### Tasks
1. **Fix `src/pages/Login.tsx`**
   - Replace `window.location.href = "/dashboard"` with `navigate("/dashboard")`
   - Add `replace: true` to prevent back-button returning to login

2. **Add logout to `AppLayout.tsx`**
   - Add logout icon/button in sidebar footer
   - Clear `localStorage.removeItem("token")`
   - Navigate to `/login`

3. **Validate JWT secret on boot**
   - In `api/boot.ts`, on startup, check `process.env.JWT_SECRET`
   - If missing or default value, log a loud warning but don't crash

4. **Token refresh consideration (optional)**
   - Add token expiry check on `trpc.auth.me.useQuery`
   - If 401, redirect to login

### Success Criteria
- [ ] Login/register use SPA navigation (no full reload)
- [ ] Logout button visible and functional
- [ ] Expired/invalid token redirects to login gracefully

---

## Milestone 4: Schema Consolidation & Dead Code Removal (P1 — Maintenance)
**Objective:** No orphaned routers, no competing DB connection files, no schema drift.

### Tasks
1. **Consolidate DB connection**
   - Evaluate `api/queries/connection.ts` vs `db/connection.ts`
   - Keep `db/connection.ts` as the single source of truth
   - Update any imports from `./queries/connection` to `@db/connection`
   - Delete `api/queries/connection.ts`

2. **Clean up old auth files**
   - Evaluate `api/context.ts` — if unused, delete
   - Evaluate `api/kimi/*` — if old Kimi auth is no longer used, delete
   - Keep only what's actively imported by `boot.ts` or routers

3. **Old table decision**
   - `brand_assets`, `documents`, `system_config` — decide: add to schema or drop tables
   - If dropping: write migration `004-drop-unused-tables.sql`
   - If keeping: add to `db/schema.ts` with proper Drizzle definitions

4. **Update `_app.ts` router wiring**
   - Ensure every active router is listed
   - Remove commented/dead router references

### Success Criteria
- [ ] Single `getDb()` function used everywhere
- [ ] No orphaned router files
- [ ] No old auth files cluttering `api/`
- [ ] All DB tables have Drizzle schema definitions

---

## Milestone 5: End-to-End Validation (P1 — QA)
**Objective:** Manual click-through of every user journey to confirm integration.

### Test Script
1. **Auth**
   - [ ] Register new account → auto-login → redirect to dashboard
   - [ ] Logout → redirect to login
   - [ ] Login → redirect to dashboard

2. **Stacks**
   - [ ] Create new stack from dashboard
   - [ ] Invite member by email
   - [ ] Remove member
   - [ ] Switch between stacks

3. **API Keys**
   - [ ] Set master password
   - [ ] Add OpenAI API key
   - [ ] Verify key is encrypted in DB
   - [ ] Verify master password required to view value
   - [ ] Delete key

4. **Agents**
   - [ ] Create agent with all fields
   - [ ] Edit agent (change model, temperature)
   - [ ] Link API key to agent
   - [ ] Delete agent

5. **Console**
   - [ ] Open agent console
   - [ ] Send test message
   - [ ] Verify log stream shows activity

6. **Webhooks**
   - [ ] Create input source webhook
   - [ ] Trigger webhook via curl
   - [ ] Verify agent receives payload

---

## Implementation Order

| Phase | Milestones | Est. Time |
|-------|-----------|-----------|
| 1 | Milestone 1 (Secure API Keys) | 2–3 hrs |
| 2 | Milestone 2 (Agent Credentials) | 2–3 hrs |
| 3 | Milestone 3 (Auth Polish) | 1 hr |
| 4 | Milestone 4 (Schema Cleanup) | 1–2 hrs |
| 5 | Milestone 5 (E2E Validation) | 1 hr |

**Total estimated effort: 7–10 hours**

---

## Files to Modify (Checklist)

### Backend
- [ ] `api/settings-router.ts` — rewrite with encryption + master password
- [ ] `api/agent-router.ts` — add credential linking
- [ ] `api/agent-credentials-router.ts` — fix imports, wire into `_app.ts`, or merge
- [ ] `api/_app.ts` — wire/unwire routers
- [ ] `api/boot.ts` — JWT secret validation
- [ ] `db/schema.ts` — add `agentCredentials`, `masterPassword` if needed
- [ ] `db/connection.ts` — verify it's the single source
- [ ] `api/queries/connection.ts` — delete after consolidation
- [ ] `api/context.ts` — delete if unused
- [ ] `api/apikeys-router.ts` — delete after merge

### Frontend
- [ ] `src/pages/Settings.tsx` — master password modal, masked keys
- [ ] `src/pages/Agents.tsx` — credential selector in edit modal
- [ ] `src/pages/Login.tsx` — SPA navigation
- [ ] `src/components/layout/AppLayout.tsx` — logout button
- [ ] `src/trpc.ts` — token expiry handling (optional)

### Migrations
- [ ] `db/migrations/004-add-master-password.sql` (if needed)
- [ ] `db/migrations/005-agent-credentials.sql` (if needed)
- [ ] `db/migrations/006-drop-unused-tables.sql` (optional)
