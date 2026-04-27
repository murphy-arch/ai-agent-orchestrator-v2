# Phase 4: Stack Blueprint Design Prompts

Run these after Phase 3 is human-approved. Blueprints are pre-built stack configurations that users apply with one click.

---

## Agent 4A: Blueprint Architect

**Role:** You are a solutions architect designing complete multi-agent stacks for common business outcomes.

**Input:**
- Approved agent archetypes from Phase 3
- Approved skills taxonomy from Phase 1B
- Role patterns from Phase 1C

**Task:** Design 25 stack blueprints. Each blueprint is a complete, deployable configuration.

**Blueprint Categories (5 per category):**
1. **Customer Operations** — support, success, onboarding, retention
2. **Content & Marketing** — creation, distribution, optimization, analysis
3. **Product & Engineering** — development, QA, DevOps, product management
4. **Revenue & Sales** — prospecting, closing, expansion, RevOps
5. **Intelligence & Research** — market research, competitive analysis, academic research

**Output Format:**

```json
[
  {
    "slug": "saas-customer-success-stack",
    "name": "SaaS Customer Success Stack",
    "description": "End-to-end customer success operation from onboarding to renewal. Includes health monitoring, proactive outreach, and escalation handling.",
    "industry": "saas",
    "category": "operational",
    "complexityLevel": 3,
    "agentConfigs": [
      {
        "agentFunctionSlug": "customer-onboarding-specialist",
        "name": "Onboarding Guide",
        "hierarchyRole": "worker",
        "modelProvider": "openai",
        "modelName": "gpt-4o-mini",
        "temperature": 80,
        "maxTokens": 2048
      },
      {
        "agentFunctionSlug": "customer-health-analyst",
        "name": "Health Score Analyst",
        "hierarchyRole": "worker"
      },
      {
        "agentFunctionSlug": "escalation-manager",
        "name": "Escalation Manager",
        "hierarchyRole": "manager"
      },
      {
        "agentFunctionSlug": "renewal-coordinator",
        "name": "Renewal Coordinator",
        "hierarchyRole": "worker"
      }
    ],
    "workflowTemplateId": null,
    "requiredIntegrations": ["Salesforce", "Zendesk", "Slack", "Product Analytics"],
    "setupInstructions": "1. Connect your CRM and support tools. 2. Import your customer health scoring rubric. 3. Configure escalation thresholds in the Escalation Manager. 4. Set up scheduled health checks.",
    "estimatedMonthlyCost": {
      "openai": 45,
      "anthropic": 0
    },
    "isPremium": false
  }
]
```

**Requirements:**
- Every `agentFunctionSlug` MUST exist in the approved Phase 3 dataset
- Every blueprint must have 2-6 agents
- At least one agent must have `hierarchyRole` of `manager` or `orchestrator` if there are 3+ agents
- `complexityLevel` must reflect the coordination complexity (2 agents = level 1-2, 6 agents = level 4-5)
- `setupInstructions` must be actionable, step-by-step, max 500 chars
- `estimatedMonthlyCost` should be realistic based on token usage (assume 1K requests/month per agent)
- `description` must explain the BUSINESS OUTCOME, not just the agents involved

---

## Agent 4B: Blueprint Workflow Designer

**Role:** You are a workflow engineer mapping how agents in a blueprint connect and communicate.

**Input:** A single blueprint from Agent 4A.

**Task:** Design the workflow graph (nodes and edges) that connects the blueprint's agents.

**Output Format:**

```json
{
  "blueprintSlug": "saas-customer-success-stack",
  "workflow": {
    "nodes": [
      { "type": "trigger", "positionX": 100, "positionY": 100, "data": { "triggerType": "schedule", "cron": "0 9 * * *" } },
      { "type": "agent", "blueprintAgentIndex": 1, "positionX": 300, "positionY": 100, "data": { "purpose": "Analyze health scores" } },
      { "type": "agent", "blueprintAgentIndex": 0, "positionX": 500, "positionY": 50, "data": { "purpose": "Proactive onboarding outreach" } },
      { "type": "agent", "blueprintAgentIndex": 2, "positionX": 500, "positionY": 150, "data": { "purpose": "Escalate at-risk accounts" } },
      { "type": "output", "positionX": 700, "positionY": 100, "data": { "outputType": "slack" } }
    ],
    "edges": [
      { "sourceId": 1, "targetId": 2, "condition": null },
      { "sourceId": 2, "targetId": 3, "condition": "health_score:<70" },
      { "sourceId": 2, "targetId": 4, "condition": "health_score:>=70" },
      { "sourceId": 3, "targetId": 5, "condition": null },
      { "sourceId": 4, "targetId": 5, "condition": null }
    ]
  }
}
```

**Requirements:**
- `blueprintAgentIndex` maps to the index in `agentConfigs` array (0-based)
- Every agent node must have a `blueprintAgentIndex`
- Trigger node must be first
- Output node must be last
- Conditions must use valid syntax: `contains:word`, `starts_with:Hello`, `equals:value`, `regex:pattern`, `error:`, `loop:`
- No orphaned nodes (every node must be reachable from trigger)
- No dead ends (every path must lead to output)

---

## Agent 4C: Blueprint Validator

**Role:** You are a QA engineer testing stack blueprints for deployability.

**Input:** All blueprints from 4A + workflows from 4B.

**Task:** Validate that every blueprint can actually be deployed without errors.

**Output:**

```json
{
  "valid": true,
  "blueprintsChecked": 25,
  "errors": [
    {
      "blueprintSlug": "broken-blueprint",
      "severity": "error",
      "message": "Agent 'escalation-manager' has hierarchyRole 'worker' but blueprint has no manager/orchestrator despite having 4 agents"
    }
  ],
  "warnings": [
    {
      "blueprintSlug": "expensive-blueprint",
      "severity": "warning",
      "message": "Estimated monthly cost ($240) is high. Consider using gpt-4o-mini for 2 of the simpler agents."
    }
  ]
}
```

**Validation Rules:**
1. Every `agentFunctionSlug` exists in approved dataset
2. If 3+ agents, at least one must be manager or orchestrator
3. Every blueprint has a trigger and an output
4. Workflow graph is connected (no islands)
5. Estimated cost is reasonable ($10-$300/month range)
6. `requiredIntegrations` are named consistently (no "Salesforce" vs "salesforce")
7. No agent appears twice in the same blueprint

---

## Agent 4D: Documentation Writer

**Role:** You are a technical writer creating user-facing documentation for each blueprint.

**Input:** Approved blueprints.

**Task:** Write a 1-paragraph "Why use this?" and a "Quick Start" for each blueprint.

**Output:** Update the `setupInstructions` field to include:
- What problem this solves (2-3 sentences)
- What the user needs to configure (bullet list)
- Expected time to first value (e.g., "15 minutes")
- Example input/output

---

## Final Data Export

After all phases complete and are human-approved, export three clean JSON files:

1. `agent_archetypes.json` — Array of all agent functions
2. `skills_taxonomy.json` — Array of all skills
3. `stack_blueprints.json` — Array of all blueprints

These can be imported via the admin API endpoints (`skill.create`, `agentFunction.create`, `stackBlueprint.create`) or inserted directly into the database.
