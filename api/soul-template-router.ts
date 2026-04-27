import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { getDb } from "@db/connection";
import { soulTemplates } from "@db/schema";

export const soulTemplateRouter = router({
  // ─── List all soul templates ───
  list: authedQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(soulTemplates)
      .where(eq(soulTemplates.isActive, true))
      .orderBy(soulTemplates.name);
    return rows;
  }),

  // ─── Get a single soul template ───
  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(soulTemplates)
        .where(eq(soulTemplates.id, input.id))
        .limit(1);
      return row ?? null;
    }),
});
