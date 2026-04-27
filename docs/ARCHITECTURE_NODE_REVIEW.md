# Workflow Node Architecture Review

## Current Node Inventory (11 types)

| # | Node | Category | Practicality | Assessment |
|---|------|----------|-------------|------------|
| 1 | **agent** | AI / LLM | ⭐⭐⭐⭐⭐ | Core workhorse. Handles credential resolution, conversation history, memory injection, session variables, and LLM calling. Well-implemented. |
| 2 | **trigger** | Flow Control | ⭐⭐⭐⭐⭐ | Clean entry point for manual/automated runs. Works as intended. |
| 3 | **input** | Integration | ⭐⭐☆☆☆ | Conceptually distinct from `trigger` (supports Telegram, Webhook, WebSocket, API configs) but the execution engine treats it identically — just a pass-through. The input type config is stored but never used for routing. **Redundant with trigger.** |
| 4 | **output** | Integration | ⭐⭐⭐⭐☆ | Pass-through + optional external dispatch. Supports 8 channels (Webhook, Telegram, Slack, Discord, Email, SMS, API, Google Drive). Well implemented. |
| 5 | **memory** | State | ⭐⭐⭐⭐☆ | Stores context into the `memories` table. Simple, effective. Could benefit from embedding-based retrieval instead of keyword-only. |
| 6 | **knowledge** | RAG | ⭐⭐⭐⭐☆ | Retrieves document chunks via embeddings with full-text fallback. Borrowing credentials from the first active agent is a pragmatic workaround but fragile. |
| 7 | **variable-set** | State | ⭐⭐⭐⭐☆ | Session-scoped variables for the current run only. Useful for passing state between nodes. |
| 8 | **delay** | Flow Control | ⭐⭐⭐⭐☆ | Simple `sleep(delayMs)`. Useful for rate-limiting and timed sequences. |
| 9 | **loop** | Flow Control | ⭐⭐☆☆☆ | **BROKEN.** Uses a `visited` Set to prevent infinite loops, but this also prevents legitimate loop-back edges from executing on subsequent iterations. Loop-body nodes are only visited once. |
| 10 | **parallel** | Flow Control | ⭐⭐⭐⭐☆ | Fan-out to all downstream edges simultaneously. Works correctly. |
| 11 | **team** | AI / Multi-Agent | ⭐⭐⭐⭐☆ | Delegates to the multi-agent engine (orchestrator → workers → synthesizer). Good abstraction but requires pre-configured teams. |

---

## Critical Issues Found

### 1. Loop Node is Non-Functional
**Severity: High**

The `visited` Set at line 309 of `workflow-engine.ts` marks every node as visited after first execution. When a `loop:` edge tries to route back to a previously-executed node, the BFS queue processor skips it:

```ts
if (visited.has(nodeId)) continue;  // This kills loop-back edges
```

**Fix:** Loop-back edges should bypass the visited check, or the visited set should track `(nodeId, loopCount)` tuples instead of just `nodeId`.

### 2. Input/Trigger Redundancy
**Severity: Medium**

Both `input` and `trigger` nodes do the exact same thing — pass context through unchanged. The `input` node stores `inputType`, `botToken`, `sourceName` but the execution engine never reads these fields. 

**Recommendation:** Either merge them into a single "start" node type, or make `input` actually route based on the trigger source (e.g., only activate if the incoming webhook matches the configured `inputType`).

### 3. Missing Human-in-the-Loop Capability
**Severity: High (Production Gap)**

There is **no way to pause a workflow for human approval**. This is a critical gap for production use cases:
- Content publishing workflows (approve before posting)
- Financial approval workflows (manager sign-off)
- Sensitive data access (verify before exposing PII)
- High-stakes AI decisions (doctor reviews AI diagnosis)

**Added:** New `human-gateway` node type to fill this gap.

---

## Recommended Node Priority for Future Work

| Priority | Node | Use Case |
|----------|------|----------|
| P0 | **human-gateway** | Pause for human approval (implemented below) |
| P1 | **condition** | Diamond-shaped branch with true/false outputs (legacy component exists but unused) |
| P1 | **fix loop** | Make loop-back edges actually work |
| P2 | **merge input/trigger** | Remove redundancy |
| P2 | **webhook** | Dedicated outbound webhook node with retry logic |
| P3 | **filter** | Drop messages that don't match criteria (can be done with edges, but explicit node is clearer) |
| P3 | **aggregator** | Collect outputs from multiple parallel branches and merge them |

---

## New Node: Human Intervention Gateway

### What It Does
Pauses workflow execution and creates a pending approval request. A human reviewer can:
- **Approve** — continue workflow with the original context
- **Approve with edits** — continue workflow with modified context
- **Reject** — route to a rejection/error path
- **Let timeout** — auto-approve or auto-reject based on configuration

### Configuration Options
- `approvalPrompt` — Custom message shown to the reviewer explaining what needs approval
- `timeoutMinutes` — Auto-resolve after N minutes (0 = no timeout)
- `timeoutAction` — `approve` or `reject` when timeout expires
- `requiredRole` — Future: restrict to users with specific roles

### Execution Behavior
1. Node receives context from upstream
2. Creates `humanApprovals` record with status `pending`
3. Updates `executionRuns.status = "paused"`
4. Returns from `runWorkflow` immediately
5. Workflow remains paused until `execution.resumePausedRun` is called
6. On resume, downstream nodes receive the human's response as context

### Database Schema
```sql
human_approvals:
  id, runId, nodeId, stackId, userId,
  status (pending/approved/rejected),
  context (what was sent for review),
  response (human's input/modification),
  prompt (the approval prompt text),
  createdAt, resolvedAt
```
