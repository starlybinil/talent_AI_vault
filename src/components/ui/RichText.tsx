import { parseRichText, type Inline } from "@/lib/richtext";
import { cn } from "@/lib/utils";

function Spans({ xs }: { xs: Inline[] }) {
  return (
    <>
      {xs.map((x, i) => (
        <span key={i} className={cn(x.bold && "font-bold text-ink", x.italic && "italic", x.underline && "underline")}>
          {x.text}
        </span>
      ))}
    </>
  );
}

/** Renders agreement text written with the formatting toolbar (see src/lib/richtext.ts). */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {parseRichText(text).map((b, i) =>
        b.type === "heading" ? (
          <p key={i} className="pt-1 text-base font-black text-ink">
            <Spans xs={b.inline} />
          </p>
        ) : b.type === "paragraph" ? (
          <p key={i}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Spans xs={l} />
              </span>
            ))}
          </p>
        ) : b.type === "bullets" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>
                <Spans xs={it} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>
                <Spans xs={it} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
