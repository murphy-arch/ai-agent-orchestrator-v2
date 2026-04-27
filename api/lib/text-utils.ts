// Pure text utilities — no external dependencies

export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let slice = text.slice(start, end);
    if (end < text.length) {
      const lastPeriod = slice.lastIndexOf(".");
      const lastNewline = slice.lastIndexOf("\n");
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > chunkSize * 0.5) {
        slice = slice.slice(0, breakPoint + 1);
      }
    }
    chunks.push(slice.trim());
    start += slice.length - overlap;
    if (start <= 0 || start >= text.length) break;
  }

  return chunks.filter((c) => c.length > 50);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
