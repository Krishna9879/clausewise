import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import postgres from "postgres";

async function main() {
  console.log("Connecting to PostgreSQL to verify extensions...");
  const sql = postgres(env.DATABASE_URL, { prepare: false });

  try {
    // 1. Enable pgvector extension
    console.log("Ensuring vector extension exists...");
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log("✓ pgvector extension is enabled.");

    // 2. Ensure Supabase storage bucket exists
    console.log(`Checking Supabase Storage bucket: "${env.SUPABASE_BUCKET}"...`);
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error("Error listing buckets:", listError.message);
    } else {
      const exists = buckets?.some((b) => b.name === env.SUPABASE_BUCKET);
      if (!exists) {
        console.log(`Bucket "${env.SUPABASE_BUCKET}" does not exist. Creating private bucket...`);
        const { error: createError } = await supabase.storage.createBucket(env.SUPABASE_BUCKET, {
          public: false,
          fileSizeLimit: env.MAX_UPLOAD_MB * 1024 * 1024,
        });
        if (createError) {
          console.error("Failed to create bucket:", createError.message);
        } else {
          console.log(`✓ Created private storage bucket: "${env.SUPABASE_BUCKET}".`);
        }
      } else {
        console.log(`✓ Supabase Storage bucket "${env.SUPABASE_BUCKET}" already exists.`);
      }
    }
  } catch (err) {
    console.error("Setup error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Fatal error during backend setup:", err);
  process.exit(1);
});
