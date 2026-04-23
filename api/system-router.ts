import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { systemConfig, aiAgents, apiKeys, workflowNodes, workflowEdges, inputSources, brandAssets } from "@db/schema";

export const systemRouter = createRouter({
  health: publicQuery.query(async () => {
    const db = getDb();
    const agents = await db.select().from(aiAgents);
    const keys = await db.select().from(apiKeys);

    const activeAgents = agents.filter((a) => a.isEnabled).length;
    const totalAgents = agents.length;
    const configuredKeys = keys.filter((k) => k.isActive).length;
    const totalKeys = keys.length;

    return {
      status: "healthy" as const,
      agents: { active: activeAgents, total: totalAgents },
      apiKeys: { configured: configuredKeys, total: totalKeys },
      ready: totalAgents > 0 && configuredKeys > 0,
    };
  }),

  getConfig: publicQuery
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, input.key));
      return config?.value ?? null;
    }),

  setConfig: publicQuery
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.key, input.key));

      if (existing) {
        await db.update(systemConfig).set({ value: input.value }).where(eq(systemConfig.id, existing.id));
      } else {
        await db.insert(systemConfig).values({ key: input.key, value: input.value });
      }

      return { success: true };
    }),

  getOnboardingStatus: publicQuery.query(async () => {
    const db = getDb();
    const [stepConfig] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "onboarding_step"));
    const [completedConfig] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "onboarding_completed"));

    return {
      step: stepConfig?.value ? parseInt(stepConfig.value) : 0,
      completed: completedConfig?.value === "true",
    };
  }),

  setOnboardingStep: publicQuery
    .input(z.object({ step: z.number(), completed: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const [existingStep] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, "onboarding_step"));

      if (existingStep) {
        await db
          .update(systemConfig)
          .set({ value: String(input.step) })
          .where(eq(systemConfig.id, existingStep.id));
      } else {
        await db.insert(systemConfig).values({ key: "onboarding_step", value: String(input.step) });
      }

      if (input.completed !== undefined) {
        const [existingCompleted] = await db
          .select()
          .from(systemConfig)
          .where(eq(systemConfig.key, "onboarding_completed"));

        if (existingCompleted) {
          await db
            .update(systemConfig)
            .set({ value: String(input.completed) })
            .where(eq(systemConfig.id, existingCompleted.id));
        } else {
          await db
            .insert(systemConfig)
            .values({ key: "onboarding_completed", value: String(input.completed) });
        }
      }

      return { success: true };
    }),
});
