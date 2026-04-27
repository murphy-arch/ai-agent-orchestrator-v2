# AI Agent Orchestrator — User Manual

**Version 2.0.0**  
*A full-stack platform for building, deploying, and managing AI agent workflows.*

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard & Stacks](#3-dashboard--stacks)
4. [Agents](#4-agents)
5. [Architecture / Workflow Builder](#5-architecture--workflow-builder)
6. [Memory & Context](#6-memory--context)
7. [Knowledge Base (RAG)](#7-knowledge-base-rag)
8. [Schedules](#8-schedules)
9. [Templates](#9-templates)
10. [Teams (Multi-Agent Collaboration)](#10-teams-multi-agent-collaboration)
11. [Analytics & Observability](#11-analytics--observability)
12. [Public API & Webhooks](#12-public-api--webhooks)
13. [Agent Console](#13-agent-console)
14. [Settings](#14-settings)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Introduction

The **AI Agent Orchestrator** is a visual, stack-based platform for designing and running AI-powered workflows. It supports:

- **Visual Workflow Design** — Drag-and-drop canvas with conditional logic, loops, delays, and parallel execution.
- **Multi-Agent Teams** — Orchestrator-led collaboration where workers process tasks in parallel.
- **RAG Knowledge Base** — Upload documents, chunk them, and retrieve relevant context during execution.
- **Memory & Context** — Stack-scoped key-value storage with confidence scoring.
- **Scheduled Triggers** — Cron-based automation that runs workflows on a schedule.
- **Templates** — Reusable workflow presets for common use cases.
- **Public API** — External integrations via API keys with rate limiting and permissions.
- **Observability** — Execution traces, token usage, cost estimation, and latency metrics.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + Tailwind CSS + shadcn/ui |
| API | Hono + tRPC 11 + Drizzle ORM |
| Database | MySQL 8.0 |
| Scheduler | node-cron |
| LLM Providers | OpenAI, Anthropic, Groq, Ollama |

---

## 2. Getting Started

### 2.1 First Login

Open the app in your browser (default: `http://localhost:5173`).

**Default credentials:**
- Email: `dev@example.com`
- Password: `changeme123`

> **Security note:** Change the default master password and JWT secret before deploying to production.

### 2.2 Creating Your First Stack

A **stack** is an isolated workspace containing agents, workflows, memories, and settings.

1. From the **Dashboard**, click **"Create Stack"**.
2. Enter a **name** and optional **description**.
3. Choose a **plan** (Free, Pro, Enterprise).
4. Click **Create**.

You will be redirected to the new stack's **Architecture** page.

### 2.3 Two-Terminal Development

On Windows, run these in separate terminals:

```powershell
# Terminal 1 — API Server
npx tsx watch --tsconfig tsconfig.server.json api/boot.ts

# Terminal 2 — Vite Client
npx vite
```

The API runs on `localhost:3000` and the client on `localhost:5173`.

---

## 3. Dashboard & Stacks

### 3.1 Dashboard Overview

The Dashboard shows:
- All stacks you own or are a member of
- Quick stats (agent count, recent executions)
- Stack status indicators (active, paused, archived)

### 3.2 Stack Management

| Action | How To |
|--------|--------|
| Create stack | Dashboard -> "Create Stack" |
| Switch stack | Click any stack card |
| Edit stack | Stack Settings -> rename, change plan |
| Invite members | Stack Settings -> Members tab |
| Delete stack | Stack Settings -> Danger Zone |

### 3.3 Stack Roles

| Role | Permissions |
|------|-------------|
| Owner | Full control |
| Admin | Can manage agents, workflows, settings |
| Member | Can view and execute, cannot modify architecture |

---

## 4. Agents

Agents are the core AI workers in your stack. Each agent has its own:
- **System prompt** — Defines personality and behavior
- **Model provider** — OpenAI, Anthropic, Groq, or Ollama
- **Model name** — e.g., `gpt-4o`, `claude-3-sonnet`, `llama3.1`
- **Temperature** — 0-200 (stored as int, divided by 100 at runtime)
- **Max tokens** — Output limit
- **API key** — Linked via Stack Settings

### 4.1 Creating an Agent

1. Navigate to **Agents** in the sidebar.
2. Click **"New Agent"**.
3. Fill in the form:
   - **Name** — Display name
   - **Description** — Optional context
   - **System Prompt** — Instructions for the LLM
   - **Hierarchy Role** — `orchestrator`, `manager`, or `worker`
   - **Model Provider & Name** — Select from dropdown
   - **Temperature** — 0-200 slider
   - **Max Tokens** — 256-8192
4. Click **Create**.

### 4.2 Hierarchy Roles

| Role | Purpose |
|------|---------|
| **Orchestrator** | Delegates tasks to workers; used by Teams and Orchestrator Chat |
| **Manager** | Intermediate supervisor (future use) |
| **Worker** | Executes specific tasks |

### 4.3 Agent Credentials

Each agent needs an API key to call LLMs:

1. Go to **Stack Settings -> API Keys**.
2. Add a provider key (e.g., OpenAI).
3. Go to **Agents** and click **"Link API Key"** on an agent.
4. Select the key and save.

> **Master Password:** Required to decrypt and test credentials. Set it in Stack Settings.

---

## 5. Architecture / Workflow Builder

The **Architecture** page is a visual canvas for designing agent workflows using React Flow.

### 5.1 Node Types

| Node | Icon | Purpose |
|------|------|---------|
| **Trigger** | ⚡ | Entry point; receives the initial message |
| **Input** | ➡️ | External input source (webhook, Telegram) |
| **Agent** | 🤖 | Single AI agent execution |
| **Orchestrator** | 👑 | Same as Agent, labeled for hierarchy clarity |
| **Team** | 👥 | Multi-agent collaboration node |
| **Delay** | ⏱️ | Pause execution for N milliseconds |
| **Loop** | 🔄 | Repeat downstream nodes up to N iterations |
| **Parallel** | ⏩ | Fan out to multiple downstream branches simultaneously |
| **Memory** | 🧠 | Store context as a stack-scoped memory |
| **Variable Set** | 📌 | Save a value to session variables |
| **Knowledge** | 📚 | RAG retrieval — inject relevant document chunks |
| **Output** | ⬅️ | Final output; can dispatch to external channels |

### 5.2 Adding Nodes

1. Click **"Add Node"** in the top toolbar.
2. Select a node type from the dropdown.
3. The node appears on the canvas. Drag to position.

### 5.3 Connecting Nodes

1. Drag from a node's **source handle** (right side) to another node's **target handle** (left side).
2. An edge is created.

### 5.4 Conditional Edges

Click an edge to select it, then set a **condition** in the sidebar:

| Condition Syntax | Meaning |
|------------------|---------|
| `contains:word` | Context includes "word" |
| `starts_with:Hello` | Context starts with "Hello" |
| `equals:yes` | Context exactly equals "yes" |
| `regex:^\d+$` | Context matches regex |
| `error:` | Error boundary — only followed on failure |
| `loop:` | Loop back edge for Loop nodes |

### 5.5 Configuring Nodes

**Click a node** to open its config panel:

- **Agent/Orchestrator** — Select which agent runs this node
- **Delay** — Set `delayMs` (default 1000)
- **Loop** — Set `maxIterations` and `loopCondition`
- **Memory** — Set `memoryKey` and `memoryCategory`
- **Variable Set** — Set `varName`
- **Knowledge** — Set `topK` (default 5) and `useFallback` toggle
- **Team** — Set `teamId` and `mode` (`parallel` or `sequential`)
- **Output** — Set `outputType` and dispatch config

### 5.6 Running Workflows

1. Click **"Run"** in the toolbar.
2. Enter a test message in the modal.
3. Click **Execute**.
4. Results appear in a panel showing each node's output.

### 5.7 Saving Workflows

Click **"Save"** to persist nodes and edges to the database. The system:
- Soft-deletes old nodes/edges
- Inserts new ones with auto-increment IDs
- Remaps frontend string IDs to database IDs

### 5.8 Deleting Elements

- **Nodes:** Click to select, then press **Delete** key or use the panel button.
- **Edges:** Click to select, then press **Delete** key.

---

## 6. Memory & Context

### 6.1 What is Memory?

Memory is a stack-scoped key-value store for persisting information across workflow runs.

### 6.2 Memory Page

Navigate to **Memory** in the sidebar to:
- View all memories
- Search by key or value
- Add new memories manually
- Edit or delete existing memories

### 6.3 Memory Node

In workflows, the **Memory node** automatically stores its input context as a memory:
- `memoryKey` — The key name
- `memoryCategory` — Optional grouping (default: "workflow")

### 6.4 Memory in Agent Execution

When an Agent or Orchestrator node runs, the workflow engine:
1. Loads relevant memories by keyword matching
2. Injects them into the system prompt under `[Relevant Context from Memory]`

### 6.5 Session Variables

**Variable Set nodes** store temporary values for the current workflow run:
- Accessible across all subsequent nodes
- Not persisted to the database
- Cleared at the end of the run

---

## 7. Knowledge Base (RAG)

The **Knowledge Base** provides Retrieval-Augmented Generation (RAG) for your agents.

### 7.1 Uploading Documents

1. Go to **Knowledge** in the sidebar.
2. Click **"Upload Document"**.
3. Select a file (PDF, TXT, MD supported).
4. The system extracts text, chunks it, and generates embeddings.

### 7.2 Document Status

| Status | Meaning |
|--------|---------|
| `pending` | Uploaded, waiting for processing |
| `processed` | Chunked and embedded successfully |
| `error` | Processing failed |

### 7.3 How RAG Works

1. **Chunking** — Documents are split into overlapping text chunks.
2. **Embedding** — Each chunk is converted to a vector using the LLM provider's embedding API.
3. **Storage** — Chunks and embeddings are stored in `document_chunks` table.
4. **Retrieval** — At runtime, the query is embedded and cosine similarity is computed against stored chunk embeddings.

### 7.4 Knowledge Node

Add a **Knowledge node** to your workflow:
- **Top K** — Number of chunks to retrieve (default 5)
- **Use Fallback** — If embedding search returns nothing, fall back to MySQL full-text search

The retrieved chunks are injected into the downstream context as `[Relevant Knowledge]`.

### 7.5 Searching Documents

Use the search bar on the Knowledge page to find documents by name or content.

---

## 8. Schedules

**Schedules** trigger workflows automatically using cron expressions.

### 8.1 Creating a Schedule

1. Go to **Schedules** in the sidebar.
2. Click **"New Schedule"**.
3. Fill in:
   - **Name** — e.g., "Daily Report"
   - **Cron Expression** — e.g., `0 9 * * *` (daily at 9 AM)
   - **Input Message** — The message sent to the workflow trigger
   - **Active** — Toggle on/off
4. Click **Create**.

### 8.2 Cron Expression Examples

| Expression | Schedule |
|------------|----------|
| `* * * * *` | Every minute |
| `0 * * * *` | Every hour |
| `0 9 * * *` | Daily at 9:00 AM |
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `*/5 * * * *` | Every 5 minutes |

### 8.3 Managing Schedules

- **Run Now** — Manually trigger a schedule immediately
- **Edit** — Change cron, message, or active status
- **Delete** — Soft-deletes the schedule

The scheduler hot-reloads when schedules are created, updated, or deleted.

---

## 9. Templates

**Templates** are reusable workflow presets.

### 9.1 Built-in Templates

The system seeds 4 default templates on first boot:

| Template | Description |
|----------|-------------|
| **Customer Support** | Trigger -> Agent -> Output with sentiment routing |
| **Content Generator** | Trigger -> Agent -> Memory -> Output |
| **Smart Router** | Trigger -> conditional branches -> multiple agents |
| **RAG Q&A** | Trigger -> Knowledge -> Agent -> Output |

### 9.2 Using a Template

1. Go to **Templates** in the sidebar.
2. Browse the gallery.
3. Click **"Use Template"** on any card.
4. The template's nodes and edges are copied into your current stack.

### 9.3 Creating Custom Templates

1. Design a workflow in **Architecture**.
2. Go to **Templates**.
3. Click **"Save as Template"**.
4. Enter name, description, and category.
5. The current stack's nodes/edges are saved as a new template.

---

## 10. Teams (Multi-Agent Collaboration)

**Teams** enable orchestrator-led multi-agent collaboration.

### 10.1 How It Works

1. **Orchestrator Plans** — Receives the user's message and creates a delegation plan.
2. **Workers Execute** — Each team member processes their assigned task.
   - **Parallel mode** — All workers run simultaneously
   - **Sequential mode** — Workers run one after another
3. **Orchestrator Synthesizes** — Combines all worker outputs into a final response.

### 10.2 Creating a Team

1. Go to **Teams** in the sidebar.
2. Click **"New Team"**.
3. Enter:
   - **Name** — e.g., "Content Team"
   - **Orchestrator** — Select an agent with `hierarchyRole = orchestrator`
   - **Description** — Optional
4. Click **Create**.

### 10.3 Adding Members

1. Expand a team card.
2. In the **Add Agent** section, select a worker agent.
3. Choose a **role**: `worker`, `reviewer`, or `specialist`.
4. Click **Add**.

### 10.4 Team Chat

1. Go to **Console** in the sidebar.
2. Select a **team** from the left sidebar (above the agents list).
3. Type a message and send.
4. The response shows:
   - The orchestrator's synthesized answer
   - Each worker's individual output

### 10.5 Team Node in Workflows

Add a **Team node** to your architecture:
- Set `teamId` to the team's database ID
- Set `mode` to `parallel` or `sequential`

---

## 11. Analytics & Observability

### 11.1 Execution History

Go to **Analytics** in the sidebar to view:

- **Execution Runs Table** — All workflow runs with status, trigger, timestamp
- **Trace Viewer** — Step-by-step breakdown of each execution
- **Cost Summary** — Total tokens, estimated cost, average duration

### 11.2 Execution Status

| Status | Meaning |
|--------|---------|
| `running` | Currently executing |
| `completed` | Finished successfully |
| `failed` | Error occurred |

### 11.3 Trace Details

Click any execution row to open the trace modal:
- Each step shows: node type, input, output, tokens used, latency
- Error steps are highlighted in red

### 11.4 Cost Estimation

Costs are estimated using a rough formula:  
`$0.002 per 1,000 tokens` (OpenAI gpt-4o average)

> **Note:** This is an approximation. Actual costs vary by provider and model.

---

## 12. Public API & Webhooks

### 12.1 Creating API Keys

1. Go to **API Keys** in the sidebar.
2. Click **"New Key"**.
3. Enter:
   - **Name** — e.g., "Production Integration"
   - **Permissions** — Toggle: `run`, `agents`, `chat`, `executions`
   - **Rate Limit** — Requests per minute (default 60)
4. Click **Create**.
5. **Copy the plain key immediately** — it is shown only once.

### 12.2 Public Endpoints

Include your key in the `x-api-key` header.

#### POST /api/v1/{stackId}/run
Trigger a workflow run.
```json
{
  "message": "Hello world",
  "variables": { "key": "value" }
}
```

#### GET /api/v1/{stackId}/agents
List all agents in the stack.

#### POST /api/v1/{stackId}/agents/{agentId}/chat
Chat with a specific agent.
```json
{
  "message": "Hello"
}
```

#### GET /api/v1/{stackId}/executions/{runId}
Get execution run status and trace.

### 12.3 Rate Limits

- Tracked per key ID in 1-minute windows
- Returns `429 Too Many Requests` when exceeded
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

### 12.4 Webhooks

Existing webhook endpoints (no API key required):

| Endpoint | Purpose |
|----------|---------|
| POST /api/webhook/:sourceType/:sourceId | Generic webhook receiver |
| POST /api/webhook/telegram/:stackId | Telegram bot webhook |
| POST /api/webhook/trigger/:workflowId | Workflow trigger |

---

## 13. Agent Console

The **Console** is a testing environment for interacting with agents and teams.

### 13.1 Single-Agent Chat

1. Select an **agent** from the left sidebar.
2. Type a message in the input box.
3. Press **Enter** or click the send button.
4. The agent's response appears in the chat.

### 13.2 Team Chat

1. Select a **team** from the left sidebar (above agents).
2. Send a message.
3. Watch the orchestrator delegate to workers and synthesize the final answer.

### 13.3 Features

- **Conversation History** — Automatically loaded from the database
- **Debug Panel** — Toggle to see raw API responses
- **Live Logs** — Toggle to see real-time execution logs via SSE
- **Clear** — Clear the current conversation display

---

## 14. Settings

### 14.1 Stack Settings

Navigate to **Settings** in the sidebar:

- **General** — Stack name, description, status
- **API Keys** — LLM provider keys (OpenAI, Anthropic, Groq, Ollama)
- **Members** — Invite users, manage roles
- **Master Password** — Required to decrypt and test agent credentials

### 14.2 User Settings

Click **User Settings** from the global nav:
- Update profile (name, email)
- Change password

### 14.3 Model Registry

The system maps friendly names to exact API model IDs:

| Friendly Name | Provider | API ID |
|---------------|----------|--------|
| GPT-4o | OpenAI | gpt-4o |
| GPT-4o Mini | OpenAI | gpt-4o-mini |
| Claude 3.5 Sonnet | Anthropic | claude-3-5-sonnet-20241022 |
| Llama 3.1 70B | Groq | llama-3.1-70b-versatile |

---

## 15. Troubleshooting

### 15.1 Common Issues

| Issue | Solution |
|-------|----------|
| EADDRINUSE: port 3000 | Another API server is running. Kill the old process first. |
| EADDRINUSE: port 5173 | Another Vite server is running. Use `npx vite --port 5174` or kill the old one. |
| Invalid or missing API key | Check the `x-api-key` header value matches a key in **API Keys**. |
| Agent has no API key configured | Link an API key to the agent in **Stack Settings -> API Keys**. |
| No orchestrator agent found | Create an agent and set its **Hierarchy Role** to `orchestrator`. |
| Workflow nodes disappear on refresh | This is fixed — the page now uses `refetchOnWindowFocus: false`. |
| Rate limit exceeded | Wait 60 seconds or increase the key's rate limit. |

### 15.2 Database

Connection string format:
```
mysql://orchestrator:orchestrator123@localhost:3306/agentstack
```

To push schema changes:
```bash
npx drizzle-kit push --force
```

### 15.3 Logs

API logs appear in the terminal running `tsx watch`.  
Frontend logs are in the browser DevTools console.

Live execution logs are available via SSE at:
```
GET /api/logs/stream?agentId={id}
```

### 15.4 Testing

Run the test suite:
```bash
npm test
```

Current coverage: 51 tests across:
- Dispatch output
- Workflow engine
- Scheduler
- Schedule router
- Execution history router
- Template router
- Public API middleware
- Multi-agent engine

---

## Appendix A: Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| DATABASE_URL | MySQL connection string | Yes |
| JWT_SECRET | Signing key for auth tokens | Yes |
| ENCRYPTION_KEY | AES encryption for API keys | Yes |
| PORT | API server port (default 3000) | No |
| NODE_ENV | development or production | No |

---

*End of User Manual*
