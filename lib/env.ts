import { z } from "zod";
import * as dotenv from "dotenv";

// In Next.js, .env.local is loaded automatically. For scripts and background tasks, load it if process.env is missing keys.
if (typeof process !== "undefined" && process.env) {
  dotenv.config({ path: ".env.local" });
  dotenv.config(); // fallback to .env
}

const envSchema = z.object({
  // LLM configuration
  LLM_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta/openai/"),
  LLM_API_KEY: z.string().min(1, "LLM_API_KEY is required"),
  LLM_MODEL: z.string().default("gemini-2.5-flash"),
  LLM_FAST_MODEL: z.string().default("gemini-2.5-flash-lite"),
  EMBED_MODEL: z.string().default("gemini-embedding-001"),
  EMBED_DIM: z.coerce.number().default(768),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SUPABASE_BUCKET: z.string().default("documents"),

  // Inngest
  INNGEST_EVENT_KEY: z.string().optional().default("local-event-key"),
  INNGEST_SIGNING_KEY: z.string().optional().default("local-signing-key"),
  INNGEST_DEV: z.string().optional().default("true"),

  // Limits and options
  MAX_UPLOAD_MB: z.coerce.number().default(50),
  AGENT_MAX_ROUNDS: z.coerce.number().default(6),
  CONTEXT_TOKEN_BUDGET: z.coerce.number().default(60000),
  APP_PASSCODE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorIssues = result.error.issues.map((i) => ` - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${errorIssues}`);
  }

  _env = result.data;
  return _env;
}

export const env = getEnv();
