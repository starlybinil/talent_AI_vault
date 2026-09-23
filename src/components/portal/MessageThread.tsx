import { Lock } from "lucide-react";
import { formatDateTime, cn } from "@/lib/utils";

export type Message = { id: string; body: string; internal: boolean; created_at: string; sender_id: string | null; sender_name?: string | null; from_staff?: boolean };

export function MessageThread({ messages, viewerId }: { messages: Message[]; viewerId: string }) {
  if (!messages.length) return <p className="rounded-2xl bg-mist p-6 text-center text-sm text-ink/50">No messages yet.</p>;
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const mine = m.sender_id === viewerId;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                m.internal ? "border border-dashed border-orange-300 bg-orange-50 text-orange-950" : mine ? "bg-maroon text-white" : "bg-mist text-ink",
              )}
            >
              <p className="flex items-center gap-1.5 text-xs font-bold opacity-70">
                {m.internal && <Lock className="h-3 w-3" aria-label="Internal note" />}
                {m.internal ? "Internal note · " : ""}
                {m.sender_name ?? (m.from_staff ? "Admissions" : "Applicant")} · {formatDateTime(m.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
