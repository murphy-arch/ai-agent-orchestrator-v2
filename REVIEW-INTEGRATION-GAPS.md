# Integration Gap Review — AI Agent Orchestrator v2.0.0

**Date:** 2026-04-23
**Scope:** End-to-end API ↔ Frontend ↔ DB correctness for credentials, agents, and core stack flows.
**Status:** Basic boot & health OK. Key user journeys broken.

---

## 1. Executive Summary

The v2.0.0 stack-scoped refactor merged the frontend routes and DB schema successfully, but **several backend routers were left unwired, encryption was dropped, and schema drift exists between the old DB and new Drizzle definitions**. The result:

- ✅ App boots, health check passes, stacks load, navigation works
- ❌ **API Keys stored in plain text** (regression from v1 encrypted storage)
- ❌ **Agent credentials linking broken** (`agentApiCredentials` table orphaned)
- ❌ **Old apikeys-router.ts dead** (not wired in `_app.ts`, references non-existent columns)
- ❌ **Old agent-credentials-router.ts dead** (not wired, references non-existent schema)
- ❌ **Settings page leaks key values** to all stack members
- ❌ **No master password gate** on sensitive key operations
- ⚠️ **Auth login does full page reload** (`window.location.href`) instead of SPA navigation
- ⚠️ **Two competing DB connection files** (`db/connection.ts` vs `api/queries/connection.ts`)
- ⚠️ **Old DB tables** (`master_password`, `agent_api_credentials`, `brand_assets`, `documents`, `system_config`) have no Drizzle schema

---

## 2. Critical Findings by Module

### 2.1 Credentials / API Keys — BROKEN

**Files involved:**
- `api/settings-router.ts` (ACTIVE — wired in `_app.ts`)
- `api/apikeys-router.ts` (DEAD — not wired, but has encryption logic)
- `src/pages/Settings.tsx` (ACTIVE — calls `trpc.settings.*`)
- `db/schema.ts` — `apiKeys` table

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | `settings-router.ts` stores `keyValue` in **plain text** (no `encrypt()` call) | 🔴 Critical |
| 2 | `settings-router.ts` `getStackSettings` returns `keyValue` to **any authenticated stack member** | 🔴 Critical |
| 3 | `Settings.tsx` displays raw key value with a "Copy" button to all viewers | 🔴 Critical |
| 4 | `apikeys-router.ts` (which had proper `encrypt/decrypt` + master password) is **not wired** in `_app.ts` | 🟡 High |
| 5 | `apikeys-router.ts` references `apiKeys.serviceName` and `masterPassword` table which don't exist in current schema | 🟡 High |
| 6 | No stack ownership check on key delete in `settings-router.ts` (only `verifyStackAccess`) | 🟡 High |

**Root cause:** During the v2.0.0 merge, a new `settings-router.ts` was written from scratch for stack-scoped API keys, but it omitted encryption and master-password gating that existed in the old `apikeys-router.ts`.

**Fix strategy:**
- Merge the encryption + master-password logic from `apikeys-router.ts` into `settings-router.ts`
- Update `settings-router.ts` to encrypt on create/update, decrypt only after master-password verification
- Update `Settings.tsx` to require master password before revealing key values
- Drop or repurpose `apikeys-router.ts`

---

### 2.2 Agent Credentials Linking — BROKEN

**Files involved:**
- `api/agent-credentials-router.ts` (DEAD — not wired)
- `db/schema.ts` — no `agentApiCredentials` table

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | `agent-credentials-router.ts` is **not wired** in `_app.ts` | 🟡 High |
| 2 | References `agentApiCredentials` table which **doesn't exist** in `db/schema.ts` | 🟡 High |
| 3 | Old DB has `agent_api_credentials` table from pre-v2.0 but no Drizzle mapping | 🟡 High |
| 4 | No way to assign an API key to an agent in the current UI | 🟡 High |

**Fix strategy:**
- Add `agentCredentials` table to `db/schema.ts` (or reuse old table via migration)
- Wire `agent-credentials-router.ts` into `_app.ts` OR merge its logic into `agent-router.ts`
- Add UI in `Agents.tsx` (edit modal) to select which API key/credential the agent uses

---

### 2.3 Agent Creation — MOSTLY WORKS

**Files involved:**
- `api/agent-router.ts` (wired)
- `src/pages/Agents.tsx` (inline create/edit modal)

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | Agent creation works end-to-end (tested via code review) | ✅ OK |
| 2 | No `avatarUrl` field in create form even though schema supports it | 🟢 Low |
| 3 | `isEnabled` toggle missing from create/edit form | 🟡 Medium |
| 4 | No credential/API key selector during agent creation | 🟡 Medium |

**Verdict:** Agent CRUD is functional. Minor UX gaps only.

---

### 2.4 Auth — WORKS BUT UNPOLISHED

**Files involved:**
- `api/auth-router.ts`
- `src/pages/Login.tsx`

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | Login/register functional | ✅ OK |
| 2 | `window.location.href = "/dashboard"` causes **full page reload** instead of `useNavigate` | 🟡 Medium |
| 3 | No logout button anywhere in the UI | 🟡 Medium |
| 4 | Token stored in `localStorage` (no httpOnly cookie) — XSS risk | 🟡 Medium |
| 5 | JWT secret falls back to `"change-me-in-production"` silently | 🟡 Medium |

---

### 2.5 Stack Management — WORKS

**Files involved:**
- `api/stack-router.ts`
- `src/pages/Dashboard.tsx`
- `src/components/layout/StackLayout.tsx`

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | Stack list, create, member invite all functional | ✅ OK |
| 2 | `StackLayout` stores `lastStackId` for legacy redirects | ✅ OK |
| 3 | No way to switch stacks without going back to Dashboard | 🟢 Low |
| 4 | Stack delete is hard delete (no soft archive) | 🟢 Low |

---

### 2.6 Database Schema Drift

**Old tables in DB with no Drizzle schema:**
- `agent_api_credentials`
- `master_password`
- `brand_assets`
- `documents`
- `system_config`

**Impact:** Any code referencing these via Drizzle will fail at runtime. The old `apikeys-router.ts` and `agent-credentials-router.ts` are affected.

**Fix:** Either add them to `db/schema.ts` or drop them if truly unused.

---

### 2.7 Dead / Orphaned Code

| File | Status | Action |
|------|--------|--------|
| `api/apikeys-router.ts` | Dead | Merge encryption logic into `settings-router.ts`, then delete |
| `api/agent-credentials-router.ts` | Dead | Add schema, wire into `_app.ts`, or merge into `agent-router.ts` |
| `api/queries/connection.ts` | Legacy | Consolidate with `db/connection.ts` |
| `api/context.ts` | Legacy | Delete (replaced by `middleware.ts`) |
| `api/kimi/auth.ts` | Legacy | Used by old auth; verify if still needed |
| `api/kimi/session.ts` | Legacy | Verify if still needed |

---

## 3. Priority Matrix

### 🔴 P0 — Security / Data Loss (Fix Immediately)
1. **API keys stored in plain text** — `settings-router.ts` must encrypt `keyValue`
2. **API keys visible to all stack members** — gate decryption behind master password
3. **Settings UI leaks raw key values** — hide values, require master password to reveal

### 🟡 P1 — Broken Features (Fix Before "Integratable")
4. **Agent credential linking** — add schema + API + UI to assign API keys to agents
5. **Auth polish** — SPA navigation, logout button, JWT secret validation
6. **Schema drift cleanup** — resolve old table mappings

### 🟢 P2 — UX Polish (Post-integratable)
7. **Inline stack switcher** in sidebar
8. **Agent avatar upload**
9. **isEnabled toggle in agent form**
10. **Dashboard analytics cards**

---

## 4. Recommended Architecture

### API Keys & Credentials (Unified)

Instead of separate `settings-router.ts` + `apikeys-router.ts` + `agent-credentials-router.ts`, consolidate into:

```
settings-router.ts
├── getStackSettings (returns keys WITHOUT values)
├── addApiKey (encrypts value)
├── deleteApiKey
├── verifyMasterPassword
├── listApiKeysWithValues (requires master password, decrypts)
└── getApiKeyValue (requires master password, decrypts single key)

agent-router.ts
├── list, getById, create, update, delete (existing)
└── linkCredential (new — links agent ↔ api key)
```

This removes the orphaned routers and centralizes encryption logic.
