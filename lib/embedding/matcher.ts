import type { EmbeddingMatch } from '@/types';

export interface EmbeddingEngine {
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

const DEFAULT_THRESHOLD = 0.2;

/**
 * Match a profile value against a list of options (e.g. select options or radio labels).
 * Uses embedding cosine similarity to find the best match.
 */
export async function matchOptions(
  engine: EmbeddingEngine,
  profileValue: string,
  options: { value: string; text: string }[],
  threshold = DEFAULT_THRESHOLD,
): Promise<EmbeddingMatch | null> {
  if (options.length === 0) return null;

  // --- First try exact match (case-insensitive) ---
  const exactMatch = options.find(
    (o) =>
      o.text.toLowerCase() === profileValue.toLowerCase() ||
      o.value.toLowerCase() === profileValue.toLowerCase(),
  );
  if (exactMatch) {
    return { value: exactMatch.value, text: exactMatch.text, score: 1.0 };
  }

  // --- Embedding-based similarity matching ---
  const textsToEmbed = [profileValue, ...options.map((o) => o.text || o.value)];
  const embeddings = await engine.embed(textsToEmbed);

  const profileEmbedding = embeddings[0];
  let bestMatch: EmbeddingMatch | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < options.length; i++) {
    const score = cosineSimilarity(profileEmbedding, embeddings[i + 1]);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { value: options[i].value, text: options[i].text, score };
    }
  }

  if (bestMatch && bestMatch.score >= threshold) {
    return bestMatch;
  }

  return null;
}
