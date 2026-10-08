import { env } from "@/lib/env";
import pLimit from "p-limit";

/**
 * Generates vector embeddings using the configured OpenAI-compatible endpoint.
 * Handles concurrency limiting and retries with backoff.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const limit = pLimit(3);

  // Group into batches of up to 16 texts
  const batchSize = 16;
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }

  const results: number[][] = [];

  for (const batch of batches) {
    const embeddings = await limit(async () => {
      let attempts = 0;
      while (attempts < 3) {
        try {
          const res = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, "")}/embeddings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.LLM_API_KEY}`,
            },
            body: JSON.stringify({
              model: env.EMBED_MODEL,
              input: batch,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Embedding API error ${res.status}: ${errText}`);
          }

          const data = await res.json();
          return data.data.map((item: { embedding: number[] }) => item.embedding);
        } catch (err) {
          attempts++;
          if (attempts >= 3) {
            console.warn(`Embedding failed after 3 attempts, filling with fallback dimensions:`, err);
            // Return zero vector of EMBED_DIM on irrecoverable embedding failure
            return batch.map(() => new Array(env.EMBED_DIM).fill(0));
          }
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempts)));
        }
      }
      return batch.map(() => new Array(env.EMBED_DIM).fill(0));
    });

    results.push(...embeddings);
  }

  return results;
}
