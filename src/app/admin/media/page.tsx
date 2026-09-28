import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { updateSiteMedia } from "@/app/admin/actions";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, PageHeader } from "@/components/ui";
import { SUPABASE_URL } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Media library" };

type Media = { id: string; path: string | null; url: string | null; alt: string; caption: string | null; source: string; active: boolean; created_at: string };

export default async function MediaPage() {
  await requirePermission("media.manage", "/admin/media");
  const supabase = await createClient();
  const { data } = await supabase.from("site_media").select("id, path, url, alt, caption, source, active, created_at").order("source", { ascending: false }).order("created_at", { ascending: false });
  const items = (data ?? []) as Media[];
  const src = (m: Media) => (m.path ? `${SUPABASE_URL}/storage/v1/object/public/site-media/${m.path}` : (m.url as string));
  const uploads = items.filter((m) => m.source === "upload").length;

  return (
    <div>
      <PageHeader
        eyebrow="Site"
        title="Media library"
        description="Photos shown across the public site: the featured program, program pages and the program catalog. Real program photos appear first; generated fab imagery fills in. Images rotate on each visit."
      />

      <Card>
        <h2 className="font-black">Upload program photos</h2>
        <p className="mt-1 text-sm text-ink/60">Photos from your labs, cohorts and fab visits make the site feel real. Stored in the public <code>site-media</code> bucket.</p>
        <div className="mt-4">
          <MediaUploader />
        </div>
      </Card>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-lg font-black">In the library</h2>
        <p className="text-sm text-ink/50">
          {uploads} program photo{uploads === 1 ? "" : "s"} · {items.length - uploads} generated · {items.filter((m) => m.active).length} in rotation
        </p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((m) => (
          <Card key={m.id} className={`overflow-hidden p-0 ${m.active ? "" : "opacity-60"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(m)} alt={m.alt} className="aspect-[3/2] w-full bg-ink object-cover" loading="lazy" />
            <div className="grid gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={m.source === "upload" ? "success" : "info"}>{m.source === "upload" ? "Program photo" : "Generated"}</Badge>
                {!m.active && <Badge tone="neutral">Hidden</Badge>}
                <span className="text-xs text-ink/40">{formatDate(m.created_at)}</span>
              </div>
              {m.caption && <p className="text-sm font-bold">{m.caption}</p>}
              <p className="line-clamp-2 text-xs text-ink/60">{m.alt}</p>
              <div className="flex gap-2">
                <ActionForm action={updateSiteMedia}>
                  <input type="hidden" name="media_id" value={m.id} />
                  <input type="hidden" name="op" value={m.active ? "hide" : "show"} />
                  <SubmitButton size="sm" variant="outline" pendingText="…">
                    {m.active ? "Hide" : "Show"}
                  </SubmitButton>
                </ActionForm>
                <ActionForm action={updateSiteMedia} confirm="Delete this photo permanently?">
                  <input type="hidden" name="media_id" value={m.id} />
                  <input type="hidden" name="op" value="delete" />
                  <SubmitButton size="sm" variant="ghost" pendingText="…">
                    Delete
                  </SubmitButton>
                </ActionForm>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
