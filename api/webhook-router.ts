import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicQuery } from "./middleware";
import { getDb } from "@db/connection";
import { inputSources } from "@db/schema";

export const webhookRouter = router({
  // ─── Receive a webhook from an external service ───
  receive: publicQuery
    .input(
      z.object({
        sourceType: z.string(),
        sourceId: z.number(),
        payload: z.record(z.any()),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Look up the input source
      const [source] = await db
        .select()
        .from(inputSources)
        .where(eq(inputSources.id, input.sourceId))
        .limit(1);

      if (!source) {
        return {
          success: false,
          error: "Source not found",
        };
      }

      const stackId = source.stackId;

      // Placeholder for actual webhook processing
      // In production, this would route the payload to the target agent

      return {
        success: true,
        stackId,
        message: "Webhook received",
      };
    }),
});
