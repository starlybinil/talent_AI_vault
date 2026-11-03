/**
 * Lightweight formatting for agreement text (a small Markdown subset), stored as plain text:
 *   ## Heading      - bullet      1. numbered      **bold**      *italic*      __underline__
 * Plain text without markers renders exactly as before.
 */

export type Inline = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type Block =
  | { type: "heading"; inline: Inline[] }
  | { type: "paragraph"; lines: Inline[][] }
  | { type: "bullets" | "numbers"; items: Inline[][] };

const INLINE_RE = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|\*[^*\n]+?\*)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith("**")) out.push({ text: t.slice(2, -2), bold: true });
    else if (t.startsWith("__")) out.push({ text: t.slice(2, -2), underline: true });
    else out.push({ text: t.slice(1, -1), italic: true });
    last = m.index! + t.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

const BULLET = /^\s*[-•]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,3}\s+(.*)$/;

export function parseRichText(src: string): Block[] {
  const blocks: Block[] = [];
  let para: Inline[][] | null = null;
  let list: { type: "bullets" | "numbers"; items: Inline[][] } | null = null;
  const flush = () => {
    if (para) blocks.push({ type: "paragraph", lines: para });
    if (list) blocks.push(list);
    para = null;
    list = null;
  };
  for (const raw of src.replace(/\r\n/g, "\n").split("\n")) {
    const h = raw.match(HEADING);
    const b = raw.match(BULLET);
    const n = raw.match(NUMBER);
    if (!raw.trim()) flush();
    else if (h) {
      flush();
      blocks.push({ type: "heading", inline: parseInline(h[1]) });
    } else if (b || n) {
      const type = b ? "bullets" : "numbers";
      if (para || (list && list.type !== type)) flush();
      list ??= { type, items: [] };
      list.items.push(parseInline((b ?? n)![1]));
    } else {
      if (list) flush();
      (para ??= []).push(parseInline(raw));
    }
  }
  flush();
  return blocks;
}

/** Plain-text lines for the signed PDF: markers removed, bullets as "•", numbers kept. */
export function richTextToPdfLines(src: string): Array<{ text: string; heading?: boolean; indent?: boolean }> {
  const plain = (xs: Inline[]) => xs.map((x) => x.text).join("");
  const lines: Array<{ text: string; heading?: boolean; indent?: boolean }> = [];
  for (const b of parseRichText(src)) {
    if (lines.length) lines.push({ text: "" });
    if (b.type === "heading") lines.push({ text: plain(b.inline), heading: true });
    else if (b.type === "paragraph") b.lines.forEach((l) => lines.push({ text: plain(l) }));
    else b.items.forEach((it, i) => lines.push({ text: `${b.type === "bullets" ? "•" : `${i + 1}.`} ${plain(it)}`, indent: true }));
  }
  return lines;
}
