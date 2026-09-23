import { STATUS_LABEL, STATUS_TONE, type Status } from "@/lib/workflow";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export type TimelineEvent = { id: string; to_status: Status; note: string | null; created_at: string; actor_name?: string | null };

export function Timeline({ events, showActor }: { events: TimelineEvent[]; showActor?: boolean }) {
  if (!events.length) return <p className="text-sm text-ink/50">No activity yet.</p>;
  return (
    <ol className="relative space-y-6 border-l-2 border-ink/10 pl-6">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-4 border-white bg-maroon ring-2 ring-maroon/20" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[e.to_status]}>{STATUS_LABEL[e.to_status]}</Badge>
            <time className="text-xs text-ink/50">{formatDateTime(e.created_at)}</time>
            {showActor && e.actor_name && <span className="text-xs text-ink/50">by {e.actor_name}</span>}
          </div>
          {e.note && <p className="mt-1.5 text-sm text-ink/70">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
