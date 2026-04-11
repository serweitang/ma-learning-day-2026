import { createClient } from "@supabase/supabase-js";

const BUCKET = "2026 MA Learning";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, key);
}

/**
 * Uploads a PDF for the given maId to Supabase Storage.
 * Overwrites any existing file with the same name.
 * Returns the public URL.
 */
export async function uploadToSupabase(maId: string, buffer: Buffer): Promise<string> {
  const supabase = getClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${maId}.pdf`, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${maId}.pdf`);
  return data.publicUrl;
}
