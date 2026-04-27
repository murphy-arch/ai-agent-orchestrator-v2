import { eq } from "drizzle-orm";
import { getDb } from "@db/connection";
import { stackBlueprints, workflowTemplates } from "@db/schema";

const DEFAULT_BLUEPRINTS = [
  {
    slug: "telegram-human-gateway-gdrive",
    name: "Telegram Human-Gateway Archive",
    description:
      "Receives messages via Telegram bot, processes them with an AI agent, pauses for human approval, then archives the approved result to Google Drive. Perfect for content moderation, document drafting, invoice processing, and any workflow where a human should review AI output before it is persisted.",
    industry: "Technology",
    category: "operational",
    complexityLevel: 3,
    agentConfigs: [
      {
        agentFunctionSlug: "content-writer",
        name: "Content Processor",
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 40,
        maxTokens: 2048,
        systemPromptOverride: `You are {{AGENT_NAME}}, a precise content processor. Take the user's Telegram message, clean it up, expand abbreviations, fix grammar, and format it as a well-structured document. Maintain the original intent and tone. Output plain text suitable for file storage.`,
      },
    ],
    requiredIntegrations: ["telegram", "google-drive"],
    setupInstructions: `## Setup Instructions

### 1. Telegram Bot
1. Open Telegram and message @BotFather
2. Create a new bot with \`/newbot\`
3. Copy the **Bot Token** (e.g., \`123456789:ABCdefGHIjklMNOpqrsTUVwxyz\`)
4. In the Architecture canvas, open the **Telegram Input** node config and paste the token
5. Click **Set Webhook** to register the webhook URL

### 2. Google Drive
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the **Google Drive API**
3. Create OAuth 2.0 credentials and generate an **Access Token**
4. In the Architecture canvas, open the **Google Drive Upload** node config
5. Paste the **Access Token** and **Folder ID** (found in the Drive folder URL)

### 3. Human Gateway
1. The workflow pauses at the **Human Approval** node
2. Go to **Analytics → Pending Approvals** to review and approve/reject
3. If no action is taken within 60 minutes, the workflow auto-rejects

### 4. Test
1. Send a message to your Telegram bot
2. Check the Analytics page for the pending approval
3. Approve the request
4. Verify the file appears in your Google Drive folder`,
    estimatedMonthlyCost: { openai: 5 },
    isPremium: false,
    workflowTemplateName: "Telegram Human-Gateway Archive",
  },
];

export async function seedBlueprints() {
  const db = getDb();
  if (!db) return;

  const existing = await db
    .select({ slug: stackBlueprints.slug })
    .from(stackBlueprints)
    .where(eq(stackBlueprints.isActive, true));
  const existingSlugs = new Set(existing.map((e) => e.slug));

  let inserted = 0;
  for (const bp of DEFAULT_BLUEPRINTS) {
    if (existingSlugs.has(bp.slug)) continue;

    // Look up the linked workflow template by name
    const [wfTemplate] = await db
      .select({ id: workflowTemplates.id })
      .from(workflowTemplates)
      .where(eq(workflowTemplates.name, bp.workflowTemplateName))
      .limit(1);

    if (!wfTemplate) {
      console.warn(
        `[seed-blueprints] Workflow template "${bp.workflowTemplateName}" not found. Skipping blueprint "${bp.slug}".`
      );
      continue;
    }

    await db.insert(stackBlueprints).values({
      slug: bp.slug,
      name: bp.name,
      description: bp.description,
      industry: bp.industry,
      category: bp.category,
      complexityLevel: bp.complexityLevel,
      agentConfigs: bp.agentConfigs,
      workflowTemplateId: wfTemplate.id,
      requiredIntegrations: bp.requiredIntegrations,
      setupInstructions: bp.setupInstructions,
      estimatedMonthlyCost: bp.estimatedMonthlyCost,
      isPremium: bp.isPremium,
      isActive: true,
      usageCount: 0,
    });

    inserted++;
    console.log(`[seed-blueprints] Inserted blueprint "${bp.slug}" (templateId=${wfTemplate.id})`);
  }

  if (inserted > 0) {
    console.log(`[seed-blueprints] Inserted ${inserted} new blueprint(s)`);
  } else {
    console.log("[seed-blueprints] All blueprints already present. Skipping.");
  }
}
