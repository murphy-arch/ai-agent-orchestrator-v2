import { router } from "./middleware";
import { stackRouter } from "./stack-router";
import { agentRouter } from "./agent-router";
import { executionRouter } from "./execution-router";
import { webhookRouter } from "./webhook-router";
import { settingsRouter } from "./settings-router";
import { analyticsRouter } from "./analytics-router";
import { workflowRouter } from "./workflow-router";
import { authRouter } from "./auth-router";
import { memoryRouter } from "./memory-router";
import { executionHistoryRouter } from "./execution-history-router";
import { scheduleRouter } from "./schedule-router";
import { documentRouter } from "./document-router";
import { templateRouter } from "./template-router";
import { publicApiKeyRouter } from "./public-api-router";
import { teamRouter } from "./team-router";
import { soulTemplateRouter } from "./soul-template-router";
import { agentFunctionRouter } from "./agent-function-router";
import { skillRouter } from "./skill-router";
import { stackBlueprintRouter } from "./stack-blueprint-router";
import { outputRouter } from "./output-router";

export const appRouter = router({
  stack: stackRouter,
  agent: agentRouter,
  workflow: workflowRouter,
  execution: executionRouter,
  webhook: webhookRouter,
  settings: settingsRouter,
  analytics: analyticsRouter,
  auth: authRouter,
  memory: memoryRouter,
  executionHistory: executionHistoryRouter,
  schedule: scheduleRouter,
  document: documentRouter,
  template: templateRouter,
  publicApiKey: publicApiKeyRouter,
  team: teamRouter,
  soulTemplate: soulTemplateRouter,
  agentFunction: agentFunctionRouter,
  skill: skillRouter,
  stackBlueprint: stackBlueprintRouter,
  output: outputRouter,
});

export type AppRouter = typeof appRouter;
