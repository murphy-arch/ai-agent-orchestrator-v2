# Remaining Milestones — Safe from Swarm Conflicts

> These milestones can be executed one at a time while the Kimi 2.6 swarm works on the multi-stack SaaS architecture. They touch files the swarm is NOT modifying.

---

## Milestone 4: Electron Desktop Polish
**Files**: `electron/`, `package.json` (dev deps only), `scripts/`
**Effort**: 2–3 hours

### Scope
- Re-add `electron-updater` to devDependencies (fix lockfile sync)
- Configure auto-update server (GitHub Releases or custom S3)
- Add desktop notifications for agent events (using Electron's `Notification` API)
- Persist window state (size, position, maximized) between sessions
- Add "Start on login" toggle in tray menu
- Polish splash screen with progress indicator
- Add native OS menu items (View → Reload, Window → Minimize to Tray)

### Acceptance Criteria
- [ ] `npm run electron:dist` produces a working installer
- [ ] App checks for updates on startup
- [ ] Window state restores on relaunch
- [ ] Agent completion shows native OS notification

---

## Milestone 5: GitHub Actions CI/CD
**Files**: `.github/workflows/` (new directory), `scripts/`, `package.json`
**Effort**: 2–3 hours

### Scope
- `.github/workflows/build.yml` — build + lint + test on every PR
- `.github/workflows/deploy.yml` — auto-deploy to droplet on merge to `main`
- Build Docker image, tag with commit SHA
- SSH deploy via Tailscale to `olympus-ollama-cd.tail218dac.ts.net`
- Docker image caching for faster builds
- Slack/Discord webhook notification on deploy success/failure

### Acceptance Criteria
- [ ] PRs trigger build + typecheck + lint
- [ ] Merge to `main` triggers automatic deployment
- [ ] Failed builds block merge (branch protection)
- [ ] Deploy notification sent to configured webhook

---

## Milestone 6: WebSocket Real-Time Logs
**Files**: `api/ws-router.ts` (new), `api/_app.ts` (one-line register), `src/components/LiveLogStream.tsx` (new), `src/pages/Console.tsx`
**Effort**: 3–4 hours

### Scope
- Add WebSocket endpoint to Hono (or separate ws server on different port)
- Stream agent logs in real-time as they are inserted into `agentLogs`
- New "Live Logs" panel/page showing a tail -f style feed
- Color-coded log levels (info, error, webhook, chat)
- Filter by agent, event type, stack (post-swarm)
- Pause/resume stream button

### Acceptance Criteria
- [ ] Agent activity appears in Live Logs within 500ms
- [ ] Can filter by agent name and event type
- [ ] Stream pauses when tab is backgrounded (optional resume)
- [ ] Works alongside existing HTTP API without conflicts

---

## Milestone 7: Email SMTP Output + Output Config Modal
**Files**: `api/execution-router.ts` (dispatchOutput function), `src/pages/Architecture.tsx` (selected node panel), `src/components/flow/OutputCredentialsModal.tsx` (new)
**Effort**: 2–3 hours

### Scope
- Add real SMTP email dispatch to `dispatchOutput()` using `nodemailer`
- Add per-output-node configuration modal (like InputCredentialsModal)
- Support SendGrid, AWS SES, and generic SMTP
- Test-connection button for each output type
- Save output config to node data (localStorage or DB post-swarm)

### Acceptance Criteria
- [ ] Output node can send email via SMTP
- [ ] Output credentials editable via modal on canvas
- [ ] Test connection validates credentials before saving
- [ ] Execution trace shows "sent" or error for email outputs

---

## Milestone 8: Vector Memory & Context (RAG)
**Files**: `db/schema.ts` (new `embeddings` table — **BLOCKED until swarm finishes**), `api/embedding-router.ts` (new), `api/execution-router.ts` (context enhancement), `src/components/VectorMemoryPanel.tsx` (new)
**Effort**: 4–6 hours
**Status**: ⚠️ **WAIT** — needs `db/schema.ts` which swarm is rewriting. Schedule after swarm returns.

### Scope
- Store conversation embeddings in vector DB (or MySQL with `VECTOR` type if available)
- Use OpenAI `text-embedding-3-small` or local Ollama embeddings
- Retrieve relevant past conversations as context for agent responses
- Vector search UI to explore what the agent "remembers"
- Cosine similarity ranking

### Acceptance Criteria
- [ ] Conversations are automatically embedded after each exchange
- [ ] Agent responses include relevant past context
- [ ] Vector search UI returns semantically similar messages
- [ ] Embeddings table is scoped by stackId (post-swarm)

---

## Milestone 9: Rate Limiting & Security Hardening
**Files**: `api/middleware.ts`, `api/webhook-router.ts`, `api/lib/rate-limit.ts` (new), `docker-compose.yml`
**Effort**: 2–3 hours
**Status**: ⚠️ Partially blocked — `api/middleware.ts` is being rewritten by swarm. Schedule after swarm or implement as standalone Hono middleware.

### Scope
- Per-IP rate limiting on public endpoints (webhooks, login)
- Per-user rate limiting on authenticated endpoints (chat, execute)
- Configurable limits via env vars (`RATE_LIMIT_RPM`, `RATE_LIMIT_RPH`)
- Redis-backed rate limiting (or in-memory with sliding window)
- CORS hardening — restrict origins in production
- Helmet-style security headers
- Input sanitization middleware

### Acceptance Criteria
- [ ] Webhook endpoint limited to 60 requests/minute per IP
- [ ] Chat endpoint limited to 30 requests/minute per user
- [ ] Exceeding limit returns 429 with Retry-After header
- [ ] Security headers present on all responses

---

## Milestone 10: i18n Multi-Language Support
**Files**: `src/i18n/` (new), `src/components/LanguageSwitcher.tsx` (new), `src/pages/Settings.tsx`, all page components
**Effort**: 4–6 hours
**Status**: ⚠️ **WAIT** — touches `src/pages/*` which swarm is rewriting. Schedule after swarm returns.

### Scope
- `i18next` + `react-i18next` setup
- Language files: EN (default), ES, FR, DE, ZH
- Language switcher in settings and header
- Persist language preference to localStorage
- RTL support scaffold (for future Arabic/Hebrew)
- Date/number formatting per locale

### Acceptance Criteria
- [ ] All user-facing strings translatable
- [ ] Language switcher changes UI instantly
- [ ] Preference persists across sessions
- [ ] Fallback to English for missing translations

---

## Execution Order Recommendation

| Order | Milestone | Can Start Now? |
|-------|-----------|----------------|
| 4 | Electron Desktop Polish | ✅ Yes |
| 5 | GitHub Actions CI/CD | ✅ Yes |
| 6 | WebSocket Real-Time Logs | ✅ Yes (minimal `_app.ts` touch) |
| 7 | Email SMTP Output | ✅ Yes (touches execution-router, but only `dispatchOutput` function — easy merge) |
| 9 | Rate Limiting | ⚠️ Wait for swarm (middleware.ts conflict) |
| 8 | Vector Memory | ⚠️ Wait for swarm (schema.ts conflict) |
| 10 | i18n | ⚠️ Wait for swarm (pages conflict) |
