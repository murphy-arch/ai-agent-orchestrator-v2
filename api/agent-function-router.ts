import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, publicQuery, authedQuery, adminQuery } from "./middleware";
import { getDb } from "@db/connection";
import { agentFunctions, skills, agentFunctionSkills } from "@db/schema";

export const agentFunctionRouter = router({
  // ─── List agent functions with rich filtering ───
  list: publicQuery
    .input(
      z
        .object({
          hierarchyRole: z.string().optional(),
          industry: z.string().optional(),
          category: z.string().optional(),
          complexityLevel: z.number().min(1).max(5).optional(),
          search: z.string().optional(),
          tag: z.string().optional(),
          skillSlug: z.string().optional(),
          verified: z.boolean().optional(),
          limit: z.number().min(1).max(500).optional().default(100),
          offset: z.number().min(0).optional().default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [eq(agentFunctions.isActive, true)];

      if (input?.hierarchyRole) {
        conditions.push(eq(agentFunctions.hierarchyRole, input.hierarchyRole));
      }
      if (input?.industry) {
        conditions.push(eq(agentFunctions.industry, input.industry));
      }
      if (input?.category) {
        conditions.push(eq(agentFunctions.category, input.category));
      }
      if (input?.complexityLevel !== undefined) {
        conditions.push(eq(agentFunctions.complexityLevel, input.complexityLevel));
      }
      if (input?.verified !== undefined) {
        conditions.push(eq(agentFunctions.verified, input.verified));
      }
      if (input?.tag) {
        conditions.push(sql`JSON_CONTAINS(${agentFunctions.tags}, ${JSON.stringify(input.tag)})`);
      }
      if (input?.search) {
        const q = `%${input.search}%`;
        conditions.push(
          sql`${agentFunctions.name} LIKE ${q} OR ${agentFunctions.description} LIKE ${q} OR ${agentFunctions.tags} LIKE ${q}`
        );
      }

      // If filtering by skill slug, we need to join
      if (input?.skillSlug) {
        const [skillRow] = await db
          .select()
          .from(skills)
          .where(eq(skills.slug, input.skillSlug))
          .limit(1);

        if (skillRow) {
          const functionIds = await db
            .select({ agentFunctionId: agentFunctionSkills.agentFunctionId })
            .from(agentFunctionSkills)
            .where(eq(agentFunctionSkills.skillId, skillRow.id));

          if (functionIds.length > 0) {
            const ids = functionIds.map((f) => f.agentFunctionId);
            conditions.push(sql`${agentFunctions.id} IN (${ids.join(",")})`);
          } else {
            // No agents have this skill; return empty
            return { items: [], total: 0 };
          }
        }
      }

      const rows = await db
        .select()
        .from(agentFunctions)
        .where(and(...conditions))
        .orderBy(desc(agentFunctions.popularityScore), agentFunctions.name)
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0);

      return rows;
    }),

  // ─── Get a single agent function by ID ───
  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(agentFunctions)
        .where(eq(agentFunctions.id, input.id))
        .limit(1);
      return row ?? null;
    }),

  // ─── Get a single agent function by slug ───
  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(agentFunctions)
        .where(eq(agentFunctions.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  // ─── List industries (distinct values) ───
  listIndustries: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .selectDistinct({ industry: agentFunctions.industry })
      .from(agentFunctions)
      .where(and(eq(agentFunctions.isActive, true), sql`${agentFunctions.industry} IS NOT NULL`))
      .orderBy(agentFunctions.industry);
    return rows.map((r) => r.industry).filter(Boolean) as string[];
  }),

  // ─── List categories (distinct values) ───
  listCategories: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .selectDistinct({ category: agentFunctions.category })
      .from(agentFunctions)
      .where(and(eq(agentFunctions.isActive, true), sql`${agentFunctions.category} IS NOT NULL`))
      .orderBy(agentFunctions.category);
    return rows.map((r) => r.category).filter(Boolean) as string[];
  }),

  // ─── Admin: create an agent function ───
  create: adminQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        slug: z.string().min(1).max(100),
        description: z.string().optional(),
        skills: z.array(z.string()).optional().default([]),
        recommendedPrompt: z.string().optional(),
        recommendedProvider: z.string().optional(),
        recommendedModel: z.string().optional(),
        hierarchyRole: z.string().optional().default("worker"),
        industry: z.string().optional(),
        category: z.string().optional(),
        complexityLevel: z.number().min(1).max(5).optional().default(1),
        typicalTools: z.array(z.string()).optional().default([]),
        inputTypes: z.array(z.string()).optional().default([]),
        outputTypes: z.array(z.string()).optional().default([]),
        useCases: z.array(z.string()).optional().default([]),
        prerequisites: z.array(z.string()).optional().default([]),
        tags: z.array(z.string()).optional().default([]),
        popularityScore: z.number().optional().default(0),
        verified: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(agentFunctions).values({
        ...input,
        isDefault: false,
        isActive: true,
      });
      return { id: Number(result.insertId), ...input };
    }),

  // ─── Admin: update an agent function ───
  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        skills: z.array(z.string()).optional(),
        recommendedPrompt: z.string().optional(),
        recommendedProvider: z.string().optional(),
        recommendedModel: z.string().optional(),
        hierarchyRole: z.string().optional(),
        industry: z.string().optional(),
        category: z.string().optional(),
        complexityLevel: z.number().min(1).max(5).optional(),
        typicalTools: z.array(z.string()).optional(),
        inputTypes: z.array(z.string()).optional(),
        outputTypes: z.array(z.string()).optional(),
        useCases: z.array(z.string()).optional(),
        prerequisites: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        popularityScore: z.number().optional(),
        verified: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db
        .update(agentFunctions)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(agentFunctions.id, id));
      return { success: true };
    }),

  // ─── Admin: delete (soft) an agent function ───
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(agentFunctions)
        .set({ isActive: false })
        .where(eq(agentFunctions.id, input.id));
      return { success: true };
    }),
});
