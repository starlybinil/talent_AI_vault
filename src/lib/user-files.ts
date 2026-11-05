import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "applicant-files";

/** Every file path under a folder in the applicant-files bucket (files only; walks subfolders). */
async function listAll(supabase: SupabaseClient, prefix: string): Promise<string[]> {
  const bucket = supabase.storage.from(BUCKET);
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Folders come back without an id.
      if (item.id) out.push(path);
      else out.push(...(await listAll(supabase, path)));
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Remove the given paths in batches. */
export async function removePaths(supabase: SupabaseClient, paths: string[]): Promise<number> {
  const bucket = supabase.storage.from(BUCKET);
  for (let i = 0; i < paths.length; i += 500) {
    const { error } = await bucket.remove(paths.slice(i, i + 500));
    if (error) throw error;
  }
  return paths.length;
}

/** Delete every file a user uploaded or that was generated for them (resumes, signatures, signed agreement PDFs). */
export async function removeUserFiles(supabase: SupabaseClient, userId: string): Promise<number> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid user");
  return removePaths(supabase, await listAll(supabase, userId));
}
