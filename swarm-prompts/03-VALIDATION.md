# Phase 3: Validation Swarm Prompts

Run these in parallel on the combined output of Phase 2.

---

## Agent 3A: Schema Validator

**Input:** The full JSON array of all agent archetypes generated across all Phase 2 domain agents.

**Task:** Validate strict schema compliance.

**Output:**
```json
{
  "valid": true,
  "totalAgents": 140,
  "errors": [
    { "agentSlug": "bad-agent", "field": "skills", "message": "Skill slug 'made-up-skill' not in taxonomy" }
  ],
  "warnings": [
    { "agentSlug": "generic-agent", "message": "Description is too vague: 'Handles various tasks'" }
  ]
}
```

**Validation Rules:**
1. Every required field is present and non-empty
2. `slug` is unique across all agents
3. `skills` array contains only valid slugs from Phase 1B
4. `industry` and `category` match Phase 1A exactly
5. `hierarchyRole` is one of: worker, manager, orchestrator
6. `recommendedPrompt` contains `{{AGENT_NAME}}`
7. `complexityLevel` is 1-5
8. `popularityScore` is 0-100
9. `useCases` has 3-5 items
10. `description` is at least 40 chars and does not contain filler words like "various", "different", "multiple" without specifics

---

## Agent 3B: Deduplication Agent

**Input:** Same as 3A.

**Task:** Find semantic duplicates and near-duplicates.

**Output:**
```json
{
  "duplicates": [
    {
      "type": "exact",
      "slugs": ["content-writer", "copywriter"],
      "recommendation": "Merge into single archetype with 'copywriter' as alias tag"
    },
    {
      "type": "near",
      "slugs": ["frontend-developer", "react-developer"],
      "overlap": 0.75,
      "recommendation": "Keep both but differentiate: React developer should focus on component architecture and state management, while Frontend developer covers broader CSS, accessibility, and build tools."
    }
  ],
  "mergeProposals": [
    {
      "mergedSlug": "content-strategist",
      "sourceSlugs": ["seo-content-strategist", "social-media-strategist"],
      "rationale": "Too similar; differentiate by channel instead of separate archetypes"
    }
  ]
}
```

**Deduplication Rules:**
- EXACT duplicate: >90% skill overlap + similar description + same hierarchy
- NEAR duplicate: 60-90% skill overlap — requires differentiation recommendation
- SAFE: <60% overlap
- If 2 agents share >80% of skills, one must be removed or heavily differentiated

---

## Agent 3C: Skill Link Validator

**Input:** Phase 1B skills + Phase 2 agent archetypes.

**Task:** Verify that the skills taxonomy is actually *used* by agent archetypes. Flag orphan skills and overused skills.

**Output:**
```json
{
  "orphanSkills": ["rare-skill-slug", "unused-skill-slug"],
  "overusedSkills": [
    { "slug": "problem-solving", "count": 95, "recommendation": "Used in 68% of agents. Consider making it implicit rather than explicit." }
  ],
  "skillCoverage": {
    "totalSkills": 280,
    "skillsUsed": 245,
    "coveragePercent": 87.5
  },
  "suggestedRemovals": ["problem-solving", "communication"]
}
```

**Rules:**
- A skill used by <2 agents is an orphan — suggest removal or find agents that should use it
- A skill used by >60% of agents is overused — consider making it a baseline assumption
- Target coverage: 85%+ of skills should be referenced

---

## Agent 3D: Prompt Quality Agent

**Input:** All agent archetypes.

**Task:** Read every `recommendedPrompt`. Grade quality and flag issues.

**Output:**
```json
{
  "gradedAgents": [
    {
      "slug": "software-engineer",
      "score": 92,
      "issues": [],
      "strengths": ["Specific behaviors", "Clear guardrails", "Concrete examples"]
    },
    {
      "slug": "generic-assistant",
      "score": 34,
      "issues": ["Too vague", "No specific behaviors", "Could apply to any role"],
      "suggestedRewrite": "You are {{AGENT_NAME}}, a specialist in X who does Y with Z constraints..."
    }
  ],
  "averageScore": 78,
  "agentsRequiringRewrite": ["generic-assistant", "vague-coordinator"]
}
```

**Grading Rubric (0-100):**
- Specificity (30 pts): Does it define exact behaviors, not generic platitudes?
- Guardrails (25 pts): Does it say what NOT to do?
- Context awareness (20 pts): Does it reference tools, outputs, or stakeholders?
- Tone definition (15 pts): Is the voice clearly defined?
- Length (10 pts): 150-400 words is optimal. Too short = vague. Too long = bloated.

**Auto-fail (<50 pts) triggers:**
- Contains "You are a helpful AI assistant"
- Contains "do your best" or "try to" without specifics
- Could apply to >3 different job titles without modification

---

## Human Review Checkpoint

After Phase 3, a human must:
1. Approve or reject every merge proposal from 3B
2. Rewrite any prompts scored <60 by 3D
3. Decide whether to remove orphan skills or assign them to relevant agents
4. Lock the final dataset before Phase 4
