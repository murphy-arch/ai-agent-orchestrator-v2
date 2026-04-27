import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@db/connection";
import { documents, documentChunks } from "@db/schema";
import { createEmbedding } from "./llm-provider";
import { chunkText, cosineSimilarity } from "./text-utils";

export { chunkText, cosineSimilarity };

// ─── Process a document: chunk + embed + store ───
export async function processDocument(opts: {
  documentId: number;
  stackId: number;
  text: string;
  provider: string;
  apiKey: string;
  chunkSize?: number;
  overlap?: number;
}) {
  const db = getDb();
  if (!db) throw new Error("DB not available");

  const { documentId, stackId, text, provider, apiKey, chunkSize = 1000, overlap = 200 } = opts;

  // Delete existing chunks for this document
  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));

  const chunks = chunkText(text, chunkSize, overlap);
  if (chunks.length === 0) {
    await db
      .update(documents)
      .set({ status: "error" })
      .where(eq(documents.id, documentId));
    throw new Error("No chunks generated from document");
  }

  // Generate embeddings and store chunks
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = await createEmbedding(provider, apiKey, content);

    await db.insert(documentChunks).values({
      documentId,
      stackId,
      content,
      chunkIndex: i,
      embedding: embedding as any,
      metadata: { charCount: content.length },
    });
  }

  await db
    .update(documents)
    .set({ status: "processed" })
    .where(eq(documents.id, documentId));

  return { chunkCount: chunks.length };
}

// ─── Retrieve relevant chunks for a query ───
export async function retrieveRelevantChunks(opts: {
  stackId: number;
  query: string;
  provider: string;
  apiKey: string;
  topK?: number;
}): Promise<Array<{ content: string; similarity: number; documentId: number; chunkIndex: number }>> {
  const db = getDb();
  if (!db) throw new Error("DB not available");

  const { stackId, query, provider, apiKey, topK = 5 } = opts;

  // Generate query embedding
  const queryEmbedding = await createEmbedding(provider, apiKey, query);

  // Load candidate chunks from this stack
  const rows = await db
    .select()
    .from(documentChunks)
    .where(and(eq(documentChunks.stackId, stackId), eq(documentChunks.isActive, true)));

  // Score by cosine similarity
  const scored = rows
    .map((row) => {
      const emb = (row.embedding as number[]) || [];
      const similarity = emb.length > 0 ? cosineSimilarity(queryEmbedding, emb) : 0;
      return {
        content: row.content,
        similarity,
        documentId: row.documentId,
        chunkIndex: row.chunkIndex,
      };
    })
    .filter((r) => r.similarity > 0.7) // relevance threshold
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored;
}

// ─── Full-text search fallback ───
export async function searchChunksByText(opts: {
  stackId: number;
  query: string;
  topK?: number;
}): Promise<Array<{ content: string; documentId: number; chunkIndex: number }>> {
  const db = getDb();
  if (!db) throw new Error("DB not available");

  const { stackId, query, topK = 5 } = opts;

  // Use MySQL full-text search via raw SQL
  const rows = await db.execute(sql`
    SELECT id, document_id, content, chunk_index
    FROM document_chunks
    WHERE stack_id = ${stackId}
      AND is_active = true
      AND MATCH(content) AGAINST(${query} IN NATURAL LANGUAGE MODE)
    LIMIT ${topK}
  `);

  return (rows[0] as any[]).map((r) => ({
    content: r.content,
    documentId: r.document_id,
    chunkIndex: r.chunk_index,
  }));
}
