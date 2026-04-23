/**
 * Migration 001: Convert single-instance to multi-stack
 * - Creates a default stack for each existing user
 * - Assigns all existing data to that stack
 * - Idempotent: safe to run multiple times
 */
import { eq } from "drizzle-orm";
import { getDb } from "@db/connection";
import { users, stacks, stackMembers, aiAgents, apiKeys, workflowNodes, workflowEdges, inputSources, conversations, agentLogs } from "@db/schema";

export async function migrateToMultiStack() {
  const db = getDb();

  // ─── Idempotency check ───
  const existingStacks = await db.select().from(stacks).limit(1);
  if (existingStacks.length > 0) {
    console.log("[migration-001] Stacks table already has data. Skipping migration.");
    return;
  }

  console.log("[migration-001] Running multi-stack migration...");

  // Get all existing users
  const allUsers = await db.select().from(users);

  if (allUsers.length === 0) {
    console.log("[migration-001] No users found. Nothing to migrate.");
    return;
  }

  for (const user of allUsers) {
    // Create a default stack for this user
    const [result] = await db.insert(stacks).values({
      name: `${user.name || user.email}'s Stack`,
      slug: `default-${user.id}`,
      ownerId: user.id,
      isDefault: true,
      status: "active",
      plan: "free",
    });

    const stackId = Number(result.insertId);
    console.log(`[migration-001] Created default stack ${stackId} for user ${user.email}`);

    // Add user as stack owner
    await db.insert(stackMembers).values({
      stackId,
      userId: user.id,
      role: "owner",
    });

    // Assign all existing data to this stack
    await db.update(aiAgents).set({ stackId, createdBy: user.id }).where(eq(aiAgents.id, aiAgents.id));
    await db.update(apiKeys).set({ stackId }).where(eq(apiKeys.id, apiKeys.id));
    await db.update(workflowNodes).set({ stackId }).where(eq(workflowNodes.id, workflowNodes.id));
    await db.update(workflowEdges).set({ stackId }).where(eq(workflowEdges.id, workflowEdges.id));
    await db.update(inputSources).set({ stackId }).where(eq(inputSources.id, inputSources.id));
    await db.update(conversations).set({ stackId }).where(eq(conversations.id, conversations.id));
    await db.update(agentLogs).set({ stackId }).where(eq(agentLogs.id, agentLogs.id));
  }

  console.log("[migration-001] Migration complete.");
}
