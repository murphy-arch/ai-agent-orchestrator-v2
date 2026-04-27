# Phase 1: Taxonomy Agent Prompts

Run these sequentially. Human reviews output before proceeding to Phase 2.

---

## Agent 1A: Domain Taxonomist

**Role:** You are a SaaS product architect defining the classification system for an AI Agent Orchestrator platform.

**Task:** Define the master taxonomy of industries and categories for agent archetypes.

**Output Format:** JSON only. No commentary outside the JSON block.

```json
{
  "industries": [
    { "slug": "saas", "name": "SaaS / Technology", "description": "Software and technology companies" },
    { "slug": "healthcare", "name": "Healthcare", "description": "Medical, pharma, wellness" }
  ],
  "categories": [
    { "slug": "creative", "name": "Creative", "description": "Content, design, media production" },
    { "slug": "technical", "name": "Technical", "description": "Engineering, infrastructure, data" }
  ]
}
```

**Requirements:**
- Generate exactly 10 industries
- Generate exactly 8 categories
- Slugs must be kebab-case, max 30 chars
- Descriptions max 120 chars
- Industries must cover: Technology, Healthcare, Finance, Legal, Education, E-commerce, Marketing, Operations, Research, Creative/Media
- Categories must cover: Creative, Technical, Analytical, Operational, Management, Support, Sales, Strategic

---

## Agent 1B: Skill Taxonomist

**Role:** You are a workforce analytics specialist building a normalized skills ontology.

**Task:** Generate 250-300 skills organized into the 4 categories: `technical`, `soft`, `domain`, `tool`.

**Output Format:** JSON array. One skill per line for readability.

```json
[
  {
    "slug": "python",
    "name": "Python",
    "category": "technical",
    "subcategory": "programming",
    "difficulty": 2,
    "description": "General-purpose programming language widely used in data science and backend development.",
    "prerequisites": [],
    "relatedSkills": ["pandas", "machine-learning"]
  }
]
```

**Requirements:**
- 80-100 technical skills (programming, data, devops, cloud, design, infrastructure)
- 40-50 soft skills (communication, cognitive, management, teamwork, productivity)
- 80-100 domain skills (marketing, sales, legal, finance, research, support, management methodologies)
- 50-70 tool skills (specific software/platforms)
- Slugs must be unique, kebab-case, max 50 chars
- Difficulty: 1 (beginner) to 5 (expert)
- Every skill must have a clear 1-sentence description
- `prerequisites` must reference existing slugs in the same output (no circular deps)
- `relatedSkills` must reference 2-5 existing slugs
- Populate subcategories logically (e.g., programming, data, cloud, design, communication, cognitive, marketing, sales, legal, finance)

**Quality Gate:** After generation, verify that every `prerequisites` and `relatedSkills` slug actually exists in your output. Remove any dangling references.

---

## Agent 1C: Role Pattern Taxonomist

**Role:** You are an organizational design consultant defining how AI agents collaborate in multi-agent systems.

**Task:** Define 15-20 role patterns (collaboration archetypes) that describe how agents work together in stacks.

**Output Format:** JSON array.

```json
[
  {
    "patternSlug": "orchestrator-workers",
    "patternName": "Orchestrator + Workers",
    "description": "A single orchestrator agent delegates tasks to 2-5 worker agents in parallel or sequence.",
    "requiredRoles": ["orchestrator", "worker"],
    "typicalAgentCount": 3,
    "useCases": ["Customer support triage", "Content production pipeline"],
    "complexityLevel": 2
  }
]
```

**Requirements:**
- Patterns must cover: sequential chains, parallel execution, hierarchical trees, reviewer loops, specialist panels, competitive evaluation
- `requiredRoles` must only use: orchestrator, manager, worker, reviewer, specialist
- `typicalAgentCount`: 2-8
- `complexityLevel`: 1-5
- Each pattern needs 2-3 concrete use cases

---

## Agent 1D: Schema Validator

**Role:** You are a data quality engineer.

**Task:** Review the output from Agents 1A, 1B, and 1C. Produce a consolidated validation report.

**Output Format:**

```json
{
  "valid": true,
  "issues": [
    { "severity": "error", "message": "Skill slug 'machine-learning' referenced in relatedSkills but not defined" }
  ],
  "summary": {
    "totalIndustries": 10,
    "totalCategories": 8,
    "totalSkills": 280,
    "totalPatterns": 18,
    "uniqueSlugs": 298,
    "duplicateSlugs": []
  }
}
```

**Action if invalid:** Return `valid: false` and list every issue. Do not proceed to Phase 2 until `valid: true`.
