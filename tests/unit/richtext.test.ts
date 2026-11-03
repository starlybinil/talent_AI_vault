import { describe, expect, it } from "vitest";
import { parseInline, parseRichText, richTextToPdfLines } from "@/lib/richtext";

describe("agreement formatting", () => {
  it("parses bold, italic and underline", () => {
    expect(parseInline("Wear **long pants** and *closed-toe* __shoes__.")).toEqual([
      { text: "Wear " },
      { text: "long pants", bold: true },
      { text: " and " },
      { text: "closed-toe", italic: true },
      { text: " " },
      { text: "shoes", underline: true },
      { text: "." },
    ]);
  });

  it("groups headings, paragraphs and lists", () => {
    const blocks = parseRichText("## Lab attire\nWear proper attire.\n\n- Long pants\n- Closed-toe shoes\n\n1. Read\n2. Sign");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "bullets", "numbers"]);
  });

  it("keeps existing plain text unchanged", () => {
    const blocks = parseRichText("Line one\nLine two\n\nNext paragraph");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: "paragraph", lines: [[{ text: "Line one" }], [{ text: "Line two" }]] });
  });

  it("strips markers for the signed PDF", () => {
    expect(richTextToPdfLines("## Title\n- **Bold** item")).toEqual([
      { text: "Title", heading: true },
      { text: "" },
      { text: "• Bold item", indent: true },
    ]);
  });
});
