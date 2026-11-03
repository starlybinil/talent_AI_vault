"use client";

import * as React from "react";
import { Bold, Eye, Heading, Italic, List, ListOrdered, PenLine, Underline } from "lucide-react";
import { Textarea } from "@/components/ui";
import { RichText } from "@/components/ui/RichText";
import { cn } from "@/lib/utils";

/** Textarea with a basic formatting toolbar and a preview. The value is plain text with light markup. */
export function RichTextEditor({ name, defaultValue = "", placeholder, required, className }: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = React.useState(defaultValue);
  const [preview, setPreview] = React.useState(false);

  // Keep the controlled value in step when the form is reset after saving.
  React.useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onReset = () => setValue(defaultValue);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  const apply = (next: string, selStart: number, selEnd: number) => {
    setValue(next);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(selStart, selEnd);
    });
  };

  /** Wrap the selection (or a placeholder word) in an inline marker. */
  const wrap = (marker: string, sample: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const picked = value.slice(s, e) || sample;
    const next = value.slice(0, s) + marker + picked + marker + value.slice(e);
    apply(next, s + marker.length, s + marker.length + picked.length);
  };

  /** Prefix every selected line (or the current line). Pressing again removes the prefix. */
  const prefixLines = (kind: "heading" | "bullet" | "number") => {
    const el = ref.current;
    if (!el) return;
    const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const endIdx = value.indexOf("\n", el.selectionEnd);
    const end = endIdx === -1 ? value.length : endIdx;
    const lines = value.slice(start, end).split("\n");
    const re = kind === "heading" ? /^#{1,3}\s+/ : kind === "bullet" ? /^[-•]\s+/ : /^\d+[.)]\s+/;
    const allHave = lines.every((l) => re.test(l));
    const out = lines.map((l, i) => {
      const bare = l.replace(/^(#{1,3}|[-•]|\d+[.)])\s+/, "");
      if (allHave) return bare;
      return (kind === "heading" ? "## " : kind === "bullet" ? "- " : `${i + 1}. `) + bare;
    });
    const block = out.join("\n");
    apply(value.slice(0, start) + block + value.slice(end), start, start + block.length);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const shortcut = { b: ["**", "bold text"], i: ["*", "italic text"], u: ["__", "underlined text"] }[e.key.toLowerCase()];
    if (!shortcut) return;
    e.preventDefault();
    wrap(shortcut[0], shortcut[1]);
  };

  const tools: Array<{ label: string; icon: React.ElementType; run: () => void }> = [
    { label: "Bold (Ctrl+B)", icon: Bold, run: () => wrap("**", "bold text") },
    { label: "Italic (Ctrl+I)", icon: Italic, run: () => wrap("*", "italic text") },
    { label: "Underline (Ctrl+U)", icon: Underline, run: () => wrap("__", "underlined text") },
    { label: "Heading", icon: Heading, run: () => prefixLines("heading") },
    { label: "Bulleted list", icon: List, run: () => prefixLines("bullet") },
    { label: "Numbered list", icon: ListOrdered, run: () => prefixLines("number") },
  ];

  return (
    <div className={cn("overflow-hidden rounded-xl border border-ink/15 bg-white focus-within:border-maroon", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-ink/10 bg-mist px-2 py-1.5">
        {tools.map(({ label, icon: Icon, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            onClick={run}
            disabled={preview}
            className="rounded-lg p-2 text-ink/70 transition hover:bg-white hover:text-maroon disabled:opacity-30"
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-ink/70 hover:bg-white hover:text-maroon"
        >
          {preview ? <PenLine className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      <Textarea
        ref={ref}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        className={cn("min-h-48 rounded-none border-0 font-mono text-[13px] focus:ring-0", preview && "hidden")}
      />
      {preview && (
        <div className="min-h-48 p-4 text-sm leading-relaxed text-ink/80">
          {value.trim() ? <RichText text={value} /> : <p className="text-ink/40">Nothing to preview yet.</p>}
        </div>
      )}
      <p className="border-t border-ink/10 bg-mist px-3 py-1.5 text-[11px] text-ink/50">
        Select text and use the toolbar. Shortcuts: **bold**, *italic*, __underline__, &quot;## &quot; heading, &quot;- &quot; bullet, &quot;1. &quot; numbered.
      </p>
    </div>
  );
}
