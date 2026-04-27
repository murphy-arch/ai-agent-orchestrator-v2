import { getDb } from "@db/connection";
import { agentOutputs } from "@db/schema";

export interface SaveOutputInput {
  stackId: number;
  agentId?: number;
  workflowRunId?: number;
  name: string;
  description?: string;
  contentType?: string;
  content: string;
  mimeType?: string;
  tags?: string[];
  source?: string;
}

export async function saveAgentOutput(input: SaveOutputInput) {
  const db = getDb();
  const [result] = await db.insert(agentOutputs).values({
    stackId: input.stackId,
    agentId: input.agentId ?? null,
    workflowRunId: input.workflowRunId ?? null,
    name: input.name,
    description: input.description ?? null,
    contentType: input.contentType ?? "text",
    content: input.content,
    mimeType: input.mimeType ?? "text/plain",
    sizeBytes: Buffer.byteLength(input.content, "utf8"),
    tags: input.tags ?? [],
    source: input.source ?? "workflow",
    isArchived: false,
  });
  return { id: Number(result.insertId) };
}
