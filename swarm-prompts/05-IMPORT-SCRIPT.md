# Phase 5: Importing Swarm Output Into the Database

After the swarm generates the final JSON files, use this script to import them.

## Option A: Admin API Bulk Import

Create a temporary admin script at `scripts/import-catalog.ts`:

```typescript
import { getDb } from "@db/connection";
import { agentFunctions, skills, agentFunctionSkills, stackBlueprints } from "@db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";

async function importCatalog() {
  const db = getDb();

  // ─── 1. Import Skills ───
  const skillsJson = JSON.parse(fs.readFileSync("./data/skills_taxonomy.json", "utf-8"));
  const skillSlugToId = new Map<string, number>();

  for (const skill of skillsJson) {
    const [existing] = await db.select().from(skills).where(eq(skills.slug, skill.slug)).limit(1);
    if (existing) {
      skillSlugToId.set(skill.slug, existing.id);
      continue;
    }
    const [result] = await db.insert(skills).values({
      slug: skill.slug,
      name: skill.name,
      description: skill.description ?? null,
      category: skill.category,
      subcategory: skill.subcategory ?? null,
      difficulty: skill.difficulty ?? 1,
      prerequisites: skill.prerequisites ?? [],
      relatedSkills: skill.relatedSkills ?? [],
      popularity: skill.popularity ?? 0,
    });
    skillSlugToId.set(skill.slug, Number(result.insertId));
  }
  console.log(`Imported ${skillSlugToId.size} skills.`);

  // ─── 2. Import Agent Functions ───
  const agentsJson = JSON.parse(fs.readFileSync("./data/agent_archetypes.json", "utf-8"));
  const agentSlugToId = new Map<string, number>();

  for (const agent of agentsJson) {
    const [existing] = await db.select().from(agentFunctions).where(eq(agentFunctions.slug, agent.slug)).limit(1);
    if (existing) {
      agentSlugToId.set(agent.slug, existing.id);
      continue;
    }
    const [result] = await db.insert(agentFunctions).values({
      name: agent.name,
      slug: agent.slug,
      description: agent.description ?? null,
      skills: agent.skills ?? [],
      recommendedPrompt: agent.recommendedPrompt ?? null,
      recommendedProvider: agent.recommendedProvider ?? "openai",
      recommendedModel: agent.recommendedModel ?? "gpt-4o",
      hierarchyRole: agent.hierarchyRole ?? "worker",
      industry: agent.industry ?? null,
      category: agent.category ?? null,
      complexityLevel: agent.complexityLevel ?? 1,
      typicalTools: agent.typicalTools ?? [],
      inputTypes: agent.inputTypes ?? [],
      outputTypes: agent.outputTypes ?? [],
      useCases: agent.useCases ?? [],
      prerequisites: agent.prerequisites ?? [],
      tags: agent.tags ?? [],
      popularityScore: agent.popularityScore ?? 0,
      verified: agent.verified ?? false,
      isDefault: false,
      isActive: true,
    });
    agentSlugToId.set(agent.slug, Number(result.insertId));
  }
  console.log(`Imported ${agentSlugToId.size} agent functions.`);

  // ─── 3. Link Agent Functions to Skills ───
  for (const agent of agentsJson) {
    const agentId = agentSlugToId.get(agent.slug);
    if (!agentId) continue;

    for (const skillSlug of agent.skills ?? []) {
      const skillId = skillSlugToId.get(skillSlug);
      if (!skillId) {
        console.warn(`Skill ${skillSlug} not found for agent ${agent.slug}`);
        continue;
      }
      await db.insert(agentFunctionSkills).values({
        agentFunctionId: agentId,
        skillId: skillId,
        proficiencyLevel: 3,
        isRequired: true,
      }).onDuplicateKeyUpdate({ set: { proficiencyLevel: 3 } });
    }
  }
  console.log("Linked agent functions to skills.");

  // ─── 4. Import Stack Blueprints ───
  const blueprintsJson = JSON.parse(fs.readFileSync("./data/stack_blueprints.json", "utf-8"));

  for (const bp of blueprintsJson) {
    const [existing] = await db.select().from(stackBlueprints).where(eq(stackBlueprints.slug, bp.slug)).limit(1);
    if (existing) {
      console.log(`Blueprint ${bp.slug} already exists. Skipping.`);
      continue;
    }
    await db.insert(stackBlueprints).values({
      slug: bp.slug,
      name: bp.name,
      description: bp.description ?? null,
      industry: bp.industry ?? null,
      category: bp.category ?? null,
      complexityLevel: bp.complexityLevel ?? 1,
      agentConfigs: bp.agentConfigs,
      workflowTemplateId: bp.workflowTemplateId ?? null,
      requiredIntegrations: bp.requiredIntegrations ?? [],
      setupInstructions: bp.setupInstructions ?? null,
      estimatedMonthlyCost: bp.estimatedMonthlyCost ?? {},
      isPremium: bp.isPremium ?? false,
      isActive: true,
    });
  }
  console.log(`Imported ${blueprintsJson.length} stack blueprints.`);
}

importCatalog().catch(console.error);
```

**Usage:**
```bash
npx tsx scripts/import-catalog.ts
```

## Option B: Direct SQL Insert (for large datasets)

If the swarm generates thousands of rows, use `LOAD DATA INFILE` or bulk `INSERT` statements instead of the ORM script above for performance.

## Post-Import Checklist

- [ ] Run `SELECT COUNT(*) FROM agent_functions;` — expect 100-200+
- [ ] Run `SELECT COUNT(*) FROM skills;` — expect 200-300
- [ ] Run `SELECT COUNT(*) FROM stack_blueprints;` — expect 20-30
- [ ] Verify `agentFunctionSkills` join table has no orphans
- [ ] Spot-check 5 random agents for prompt quality
- [ ] Run the app and test `trpc.agentFunction.list` and `trpc.stackBlueprint.list`
