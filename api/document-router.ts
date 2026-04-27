import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess } from "./lib/permissions";
import { getDb } from "@db/connection";
import { documents, documentChunks } from "@db/schema";
import { processDocument, retrieveRelevantChunks } from "./lib/rag-engine";
import { resolveAgentCredential } from "./lib/workflow-engine";
import { writeFile, readFile, unlink } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export const documentRouter = router({
  // ─── List documents for a stack ───
  list: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const rows = await db
        .select()
        .from(documents)
        .where(eq(documents.stackId, input.stackId))
        .orderBy(desc(documents.createdAt));

      return rows;
    }),

  // ─── Delete a document and its chunks ───
  delete: authedQuery
    .input(z.object({ stackId: z.number(), documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, input.documentId), eq(documents.stackId, input.stackId)))
        .limit(1);

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found in this stack" });
      }

      // Delete file if exists
      if (doc?.fileType) {
        const filePath = path.join(UPLOAD_DIR, `${input.documentId}.${doc.fileType}`);
        try {
          await unlink(filePath);
        } catch {
          // ignore missing file
        }
      }

      await db.delete(documentChunks).where(eq(documentChunks.documentId, input.documentId));
      await db.delete(documents).where(and(eq(documents.id, input.documentId), eq(documents.stackId, input.stackId)));

      return { success: true };
    }),

  // ─── Search chunks (RAG retrieval) ───
  search: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        query: z.string().min(1),
        topK: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyStackAccess(ctx.user.id, input.stackId);

      // Use the first enabled agent's API key for embeddings
      const db = getDb();
      const [agent] = await db
        .select()
        .from((await import("@db/schema")).aiAgents)
        .where(eq((await import("@db/schema")).aiAgents.stackId, input.stackId))
        .limit(1);

      if (!agent) {
        throw new Error("No agent found in stack. Create one first to use RAG.");
      }

      const config = await resolveAgentCredential(agent.id);
      const results = await retrieveRelevantChunks({
        stackId: input.stackId,
        query: input.query,
        provider: config.provider,
        apiKey: config.apiKey,
        topK: input.topK,
      });

      return results;
    }),
});

// ─── Hono route for file upload (multipart) ───
// This is mounted separately in boot.ts because tRPC doesn't handle file streams well
export async function handleDocumentUpload(c: any) {
  const db = getDb();
  const stackId = Number(c.req.param("stackId"));
  const user = (c as any).get?.("user") || c.var?.user;

  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    await verifyStackAccess(user.id, stackId);
  } catch {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.parseBody({ all: true });
  const file = body.file as File;
  const agentId = Number(body.agentId);

  if (!file || !agentId) {
    return c.json({ error: "Missing file or agentId" }, 400);
  }

  // Read file content as text
  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";
  const ext = file.name.split(".").pop()?.toLowerCase() || "txt";

  if (ext === "txt" || ext === "md" || ext === "json" || ext === "csv") {
    text = buffer.toString("utf-8");
  } else if (ext === "pdf") {
    // For now, store raw bytes and mark for later processing
    // PDF text extraction would require pdf-parse or similar
    return c.json({ error: "PDF parsing not yet implemented. Upload .txt or .md files for now." }, 400);
  } else {
    return c.json({ error: "Unsupported file type. Use .txt or .md" }, 400);
  }

  // Create document record
  const [result] = await db.insert(documents).values({
    stackId,
    userId: user.id,
    name: file.name,
    fileType: ext,
    fileSize: buffer.length,
    content: text,
    status: "pending",
  });

  const documentId = Number(result.insertId);

  // Save file to disk
  const filePath = path.join(UPLOAD_DIR, `${documentId}.${ext}`);
  await writeFile(filePath, buffer);

  // Process document: chunk + embed
  try {
    const config = await resolveAgentCredential(agentId);
    const procResult = await processDocument({
      documentId,
      stackId,
      text,
      provider: config.provider,
      apiKey: config.apiKey,
    });

    return c.json({
      success: true,
      documentId,
      chunkCount: procResult.chunkCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(documents).set({ status: "error" }).where(eq(documents.id, documentId));
    return c.json({ error: msg }, 500);
  }
}
