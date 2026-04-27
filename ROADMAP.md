# AI Agent Orchestrator — Feature Roadmap

> Each milestone is a self-contained deliverable. They stack in order but can be skipped/reordered based on your priorities.

---

## Milestone 1: Workflow Logic & Control Flow
**Current gap:** The execution engine is a simple BFS. No branching, looping, or error recovery.

| Feature | Why |
|---------|-----|
| **Conditional Edges** | Edges with rules (e.g., "if response contains 'yes' → route to Node A, else Node B") |
| **Loop Nodes** | Repeat an agent until a condition is met (retry logic, refinement loops) |
| **Parallel Gateway** | Fan-out to multiple agents simultaneously, fan-in when all complete |
| **Error Boundary Nodes** | Catch agent failures and route to a fallback path instead of crashing the whole workflow |
| **Delay / Wait Nodes** | Pause execution for N seconds or until a specific time |

**Deliverable:** New node types (`condition`, `loop`, `parallel`, `delay`) + execution engine upgrades.

---

## Milestone 2: Knowledge Base & RAG
**Current gap:** Agents have no long-term memory or document access.

| Feature | Why |
|---------|-----|
| **Document Upload** | PDF, DOCX, TXT, CSV upload per stack |
| **Chunking & Embedding** | Auto-chunk documents, generate embeddings (OpenAI, local models) |
| **Vector Store** | Pinecone, Weaviate, or pgvector integration for semantic search |
| **RAG Node** | A workflow node that retrieves relevant chunks and injects them into the agent prompt |
| **Source Citations** | Agent responses cite which document chunks were used |

**Deliverable:** New `Knowledge` tab, `rag` node type, embedding pipeline.

---

## Milestone 3: Memory & Context Layer
**Current gap:** Every workflow run starts from zero. No user memory, no session state.

| Feature | Why |
|---------|-----|
| **User Memory Store** | Per-user facts/preferences extracted from conversations and persisted |
| **Session State** | Share variables across nodes within a single workflow run |
| **Global Stack Memory** | Cross-workflow memory (e.g., "this user prefers formal tone") |
| **Memory Recall Node** | Inject relevant past memories into an agent's context window |
| **Memory Management UI** | View, edit, delete stored memories per user/stack |

**Deliverable:** `memory` table, `MemoryNode`, context injection in `callLlm()`.

---

## Milestone 4: Scheduled & Event-Driven Workflows
**Current gap:** Workflows only run when manually triggered. No cron, no real event listening.

| Feature | Why |
|---------|-----|
| **Cron Triggers** | "Run this workflow every day at 9am" |
| **Calendar Integration** | Trigger on Google Calendar / Outlook events |
| **Email Trigger** | Monitor an inbox and trigger workflows on new emails |
| **File Watch Trigger** | Trigger when a file is added to Google Drive / Dropbox / S3 |
| **Polling Framework** | Generic polling system for any API that doesn't support webhooks |

**Deliverable:** `schedule` table, `cron` engine (node-cron / bullmq), new trigger types.

---

## Milestone 5: Agent Testing & Evaluation
**Current gap:** No way to know if an agent change made things better or worse.

| Feature | Why |
|---------|-----|
| **Test Suites** | Save a set of test inputs + expected outputs per agent |
| **Batch Evaluation** | Run all tests in a suite and score results |
| **LLM-as-Judge** | Use a separate "judge" agent to score responses (1-10, pass/fail, custom rubric) |
| **A/B Testing** | Run two agent versions side-by-side, compare win rates |
| **Regression Alerts** | Auto-flag if a new deploy drops test scores below threshold |

**Deliverable:** `test_cases` table, `eval_runs` table, evaluation UI in Agents tab.

---

## Milestone 6: Advanced Observability
**Current gap:** Logs are basic. No execution tracing, no cost visibility.

| Feature | Why |
|---------|-----|
| **Execution Trace** | Step-by-step replay of any workflow run (like LangSmith / Langfuse) |
| **Token & Cost Tracking** | Per-agent, per-workflow, per-stack cost breakdown |
| **Latency Heatmaps** | Visualize which nodes are slow |
| **Error Dashboard** | Grouped error types, retry success rates |
| **Real-time Execution Stream** | Watch a workflow run live (already have SSE logs — expand this) |

**Deliverable:** `execution_runs` table, trace viewer UI, cost dashboard.

---

## Milestone 7: Agent Marketplace & Templates
**Current gap:** Every agent is built from scratch.

| Feature | Why |
|---------|-----|
| **Template Library** | Pre-built agents: Customer Support, Sales Qualifier, Code Reviewer, etc. |
| **Workflow Templates** | Full workflows: "Onboarding Bot", "Content Pipeline", "Support Triage" |
| **Community Sharing** | Publish templates to a public marketplace |
| **One-Click Import** | Import a template, customize, deploy |
| **Template Ratings** | Community votes, usage stats |

**Deliverable:** `templates` table, marketplace UI, import/export system.

---

## Milestone 8: Multi-Agent Collaboration
**Current gap:** Agents run in isolation. No handoffs, no debates, no review.

| Feature | Why |
|---------|-----|
| **Agent Handoff** | One agent delegates to another mid-conversation |
| **Review Loop** | Agent A writes → Agent B reviews → back to A if rejected |
| **Roundtable Mode** | Multiple agents discuss a topic and converge on an answer |
| **Agent Registry** | Agents can discover and message each other by capability |
| **Consensus Voting** | N agents vote, majority wins |

**Deliverable:** New node types (`handoff`, `review`, `roundtable`), agent registry system.

---

## Milestone 9: External Integrations Hub
**Current gap:** Only Telegram, Slack, Discord, Email, basic webhooks, and Google Drive.

| Feature | Why |
|---------|-----|
| **Notion** | Read/write pages, databases |
| **GitHub** | Comment on PRs, create issues, read code |
| **Zapier / Make** | Bidirectional trigger ↔ action support |
| **Shopify / Stripe** | E-commerce workflows (order alerts, refund bots) |
| **Database Connectors** | Direct SQL read/write as workflow nodes |
| **REST API Builder** | Let users define custom integrations without code |

**Deliverable:** Integration plugin system, OAuth flows, connector SDK.

---

## Milestone 10: API & Developer Experience
**Current gap:** Only tRPC internal API. No public REST API or SDKs.

| Feature | Why |
|---------|-----|
| **Public REST API** | Swagger/OpenAPI docs, API keys for external callers |
| **Webhook Management** | User-defined outgoing webhooks with signing secrets |
| **Client SDKs** | TypeScript, Python, Go SDKs for embedding in apps |
| **Sandbox Environment** | Test API calls without affecting production data |
| **Rate Limiting & Quotas** | Per-key rate limits, usage quotas |

**Deliverable:** REST router (Hono), API key management, SDK repos.

---

## Milestone 11: Billing & Plan Enforcement
**Current gap:** Stacks have a `plan` field but no enforcement.

| Feature | Why |
|---------|-----|
| **Usage Metering** | Track tokens, workflow runs, API calls per stack |
| **Plan Limits** | Enforce max agents, max workflows, max tokens per plan |
| **Stripe Integration** | Upgrade/downgrade flows, invoicing |
| **Usage Alerts** | Email/Slack alert at 80% of quota |
| **Team Billing** | One bill for an organization, seat-based pricing |

**Deliverable:** `usage` table, Stripe webhooks, plan middleware.

---

## Milestone 12: Collaboration & Version Control
**Current gap:** Single-user editing. No history, no rollback.

| Feature | Why |
|---------|-----|
| **Real-Time Collaboration** | Multiple users edit a workflow simultaneously (like Figma) |
| **Version History** | Every save is a version. Diff view. One-click restore. |
| **Git Export** | Export workflow as JSON/YAML to a git repo |
| **Branching** | "Dev" vs "Prod" workflows, promote with approval |
| **Comments on Canvas** | Leave notes on nodes for teammates |

**Deliverable:** WebSocket presence, `workflow_versions` table, diff engine.

---

## Milestone 13: Security & Compliance
**Current gap:** Basic auth, encrypted keys, but no audit trails or compliance tools.

| Feature | Why |
|---------|-----|
| **Audit Log** | Every action (who changed what, when) — immutable |
| **Data Retention Policies** | Auto-delete conversations/logs after N days |
| **PII Detection** | Scan agent outputs for PII, flag or redact |
| **SSO / SAML** | Enterprise login (Google Workspace, Okta, Azure AD) |
| **IP Allowlisting** | Restrict API access by IP range |

**Deliverable:** `audit_log` table, retention cron jobs, SSO router.

---

## Milestone 14: Natural Language Workflow Builder
**Current gap:** Workflows are built by hand on the canvas.

| Feature | Why |
|---------|-----|
| **Text-to-Workflow** | "Build me a support bot that escalates to a human if the customer is angry" → auto-generates nodes + edges |
| **Agent Autocomplete** | LLM suggests the next node based on the current flow |
| **Natural Language Editing** | "Add a delay here" or "Make this branch on sentiment" |
| **Auto-Optimization** | LLM suggests improvements ("This agent could use a RAG node") |

**Deliverable:** LLM-powered workflow generator, prompt engineering layer.

---

## Milestone 15: Deployment & Scalability
**Current gap:** Single-server deployment. No auto-scaling, no worker queues.

| Feature | Why |
|---------|-----|
| **Worker Queue (BullMQ / RabbitMQ)** | Separate queue workers for workflow execution |
| **Docker Compose Production** | One-command production deploy |
| **Kubernetes Helm Chart** | Auto-scaling pods, health checks |
| **Serverless Adapter** | Deploy to Vercel / AWS Lambda for event handling |
| **Multi-Region** | Run workers close to users for low latency |

**Deliverable:** Queue infrastructure, Docker/K8s configs, deployment docs.

---

## Suggested Priority Order

If I were building this for paying customers tomorrow, I'd run them in this order:

1. **Milestone 3** (Memory) — Dramatically improves agent quality, low effort
2. **Milestone 1** (Workflow Logic) — Unlocks real-world use cases
3. **Milestone 6** (Observability) — Required before any customer goes to production
4. **Milestone 5** (Testing) — Prevents regressions as you iterate
5. **Milestone 4** (Scheduled Workflows) — Unlocks "set and forget" value
6. **Milestone 2** (RAG) — Huge differentiator, medium effort
7. **Milestone 7** (Templates) — Reduces time-to-value for new users
8. **Milestone 10** (Public API) — Unlocks integrations and resale
9. **Milestone 8** (Multi-Agent) — Power-user feature, high complexity
10. **Milestone 9+** (Integrations, Billing, Collaboration, etc.) — Scale and monetize

---

## Quick Wins (1-2 days each)

If you want immediate value before tackling a full milestone:

- **Execution Trace Viewer** — Save `execution_runs` with step-by-step JSON, build a simple tree viewer
- **Workflow Templates** — Hardcode 5 useful templates in a dropdown (Customer Support, Content Gen, etc.)
- **Token Counter in UI** — Show estimated cost per agent run
- **Keyboard Shortcuts** — Save (Ctrl+S), Run (Ctrl+Enter), Delete (Delete key)
- **Dark Mode** — Toggle between light/dark canvas themes
- **Copy/Paste Nodes** — Duplicate selected nodes with Ctrl+C / Ctrl+V
- **Undo/Redo** — Basic history stack for canvas actions
- **Agent Avatar Upload** — Let users upload custom images instead of default icons
- **Search & Filter Agents** — If you have 20+ agents, you need search
- **Export Workflow as PNG** — Literally screenshot the canvas for sharing

---

*Which milestone should we start with?*
