import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@/lib/env";

export const aiProvider = createOpenAICompatible({
  name: "custom-openai-compatible",
  baseURL: env.LLM_BASE_URL,
  apiKey: env.LLM_API_KEY,
});

export const llmModel = aiProvider(env.LLM_MODEL);
export const fastLlmModel = aiProvider(env.LLM_FAST_MODEL);
