import { router } from "./middleware";
import { stackRouter } from "./stack-router";
import { agentRouter } from "./agent-router";
import { executionRouter } from "./execution-router";
import { webhookRouter } from "./webhook-router";
import { settingsRouter } from "./settings-router";
import { analyticsRouter } from "./analytics-router";
import { workflowRouter } from "./workflow-router";
import { authRouter } from "./auth-router";

export const appRouter = router({
  stack: stackRouter,
  agent: agentRouter,
  workflow: workflowRouter,
  execution: executionRouter,
  webhook: webhookRouter,
  settings: settingsRouter,
  analytics: analyticsRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
