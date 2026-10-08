import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, sizeBytes, mime } = body;

    if (!name || !sizeBytes || !mime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate file extension
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      return NextResponse.json(
        { error: `Only PDF and DOCX files are supported. '.${ext}' was rejected.` },
        { status: 400 }
      );
    }

    // Validate size
    const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
    if (sizeBytes > maxBytes) {
      return NextResponse.json(
        { error: `File exceeds the maximum size limit of ${env.MAX_UPLOAD_MB} MB.` },
        { status: 400 }
      );
    }

    const storagePath = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    // Insert database record
    const [doc] = await db
      .insert(documents)
      .values({
        name,
        mime,
        sizeBytes,
        storagePath,
        status: "uploading",
        progress: 0,
        statusDetail: "Awaiting client upload",
      })
      .returning();

    // Create signed upload URL
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(env.SUPABASE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (uploadError || !uploadData) {
      return NextResponse.json(
        { error: `Failed to create upload URL: ${uploadError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documentId: doc.id,
      storagePath,
      signedUrl: uploadData.signedUrl,
      token: uploadData.token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload preparation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
