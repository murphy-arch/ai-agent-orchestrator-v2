import { z } from "zod";
import { eq, and, like, desc, sql } from "drizzle-orm";
import { router, publicQuery, authedQuery, adminQuery } from "./middleware";
import { getDb } from "@db/connection";
import { skills, agentFunctionSkills, agentFunctions } from "@db/schema";

export const skillRouter = router({
  // ─── List all skills ───
  list: publicQuery
    .input(
      z
        .object({
          category: z.string().optional(),
          subcategory: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(500).optional().default(100),
          offset: z.number().min(0).optional().default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const category = input?.category;
      const subcategory = input?.subcategory;
      const search = input?.search;
      const limit = input?.limit ?? 100;
      const offset = input?.offset ?? 0;

      const conditions = [eq(skills.isActive, true)];
      if (category) conditions.push(eq(skills.category, category));
      if (subcategory) conditions.push(eq(skills.subcategory, subcategory));
      if (search) {
        conditions.push(
          sql`${skills.name} LIKE ${`%${search}%`} OR ${skills.description} LIKE ${`%${search}%`}`
        );
      }

      const rows = await db
        .select()
        .from(skills)
        .where(and(...conditions))
        .orderBy(desc(skills.popularity), skills.name)
        .limit(limit)
        .offset(offset);

      return rows;
    }),

  // ─── Get a single skill by ID ───
  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(skills)
        .where(eq(skills.id, input.id))
        .limit(1);
      return row ?? null;
    }),

  // ─── Get a single skill by slug ───
  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(skills)
        .where(eq(skills.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  // ─── Get skills for a specific agent function ───
  listForAgentFunction: publicQuery
    .input(z.object({ agentFunctionId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          skill: skills,
          proficiencyLevel: agentFunctionSkills.proficiencyLevel,
          isRequired: agentFunctionSkills.isRequired,
        })
        .from(agentFunctionSkills)
        .innerJoin(skills, eq(agentFunctionSkills.skillId, skills.id))
        .where(
          and(
            eq(agentFunctionSkills.agentFunctionId, input.agentFunctionId),
            eq(skills.isActive, true)
          )
        )
        .orderBy(desc(agentFunctionSkills.proficiencyLevel), skills.name);

      return rows;
    }),

  // ─── Search skills by query string ───
  search: publicQuery
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(100).optional().default(20),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(skills)
        .where(
          and(
            eq(skills.isActive, true),
            sql`${skills.name} LIKE ${`%${input.query}%`} OR ${skills.description} LIKE ${`%${input.query}%`}`
          )
        )
        .orderBy(desc(skills.popularity))
        .limit(input.limit);

      return rows;
    }),

  // ─── Admin: create a skill ───
  create: adminQuery
    .input(
      z.object({
        slug: z.string().min(1).max(100),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z.enum(["technical", "soft", "domain", "tool"]),
        subcategory: z.string().max(100).optional(),
        difficulty: z.number().min(1).max(5).optional().default(1),
        prerequisites: z.array(z.string()).optional().default([]),
        relatedSkills: z.array(z.string()).optional().default([]),
        popularity: z.number().optional().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(skills).values({
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        subcategory: input.subcategory ?? null,
        difficulty: input.difficulty,
        prerequisites: input.prerequisites,
        relatedSkills: input.relatedSkills,
        popularity: input.popularity,
      });
      return { id: Number(result.insertId), ...input };
    }),

  // ─── Admin: update a skill ───
  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        category: z.enum(["technical", "soft", "domain", "tool"]).optional(),
        subcategory: z.string().max(100).optional(),
        difficulty: z.number().min(1).max(5).optional(),
        prerequisites: z.array(z.string()).optional(),
        relatedSkills: z.array(z.string()).optional(),
        popularity: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db
        .update(skills)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(skills.id, id));
      return { success: true };
    }),

  // ─── Admin: delete (soft) a skill ───
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(skills)
        .set({ isActive: false })
        .where(eq(skills.id, input.id));
      return { success: true };
    }),
});
