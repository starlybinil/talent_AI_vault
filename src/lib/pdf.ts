import "server-only";

import { createHash } from "crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const MAROON = rgb(0x8c / 255, 0x1d / 255, 0x40 / 255);
const GOLD = rgb(1, 0xc6 / 255, 0x27 / 255);
const INK = rgb(0x19 / 255, 0x19 / 255, 0x19 / 255);
const GRAY = rgb(0.45, 0.45, 0.45);

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

/** Latin-1 safe text for the standard PDF fonts. */
const clean = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/×/g, "x")
    .replace(/·/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");

export async function buildSignedAgreementPdf(input: {
  title: string;
  version: number;
  body: string;
  programName: string;
  signerName: string;
  signerEmail: string;
  signaturePng: Buffer;
  signedAt: Date;
  ip: string | null;
  userAgent: string;
  applicationId: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.title} - signed`);
  doc.setAuthor("Talent-Vault");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [W, H] = [612, 792];
  const margin = 56;
  let page = doc.addPage([W, H]);
  let y = H - margin;

  const header = () => {
    page.drawRectangle({ x: 0, y: H - 36, width: W, height: 36, color: INK });
    page.drawRectangle({ x: 0, y: H - 40, width: W, height: 4, color: GOLD });
    page.drawText("Talent-Vault", { x: margin, y: H - 24, size: 13, font: bold, color: rgb(1, 1, 1) });
    page.drawText(clean(input.programName), { x: margin + 110, y: H - 24, size: 9, font, color: GOLD });
    y = H - 80;
  };
  const ensure = (h: number) => {
    if (y - h < margin) {
      page = doc.addPage([W, H]);
      header();
    }
  };
  header();

  page.drawText(clean(input.title), { x: margin, y, size: 20, font: bold, color: MAROON });
  y -= 18;
  page.drawText(`Version ${input.version}`, { x: margin, y, size: 9, font, color: GRAY });
  y -= 26;

  for (const line of wrap(clean(input.body), font, 11, W - margin * 2)) {
    ensure(16);
    page.drawText(line, { x: margin, y, size: 11, font, color: INK });
    y -= 16;
  }

  y -= 20;
  ensure(190);
  page.drawRectangle({ x: margin, y: y - 170, width: W - margin * 2, height: 170, borderColor: MAROON, borderWidth: 1, color: rgb(0.99, 0.98, 0.95) });
  page.drawText("ELECTRONIC SIGNATURE", { x: margin + 14, y: y - 20, size: 9, font: bold, color: MAROON });
  const img = await doc.embedPng(input.signaturePng);
  const scale = Math.min(220 / img.width, 70 / img.height);
  page.drawImage(img, { x: margin + 14, y: y - 100, width: img.width * scale, height: img.height * scale });
  page.drawLine({ start: { x: margin + 14, y: y - 104 }, end: { x: margin + 260, y: y - 104 }, thickness: 0.7, color: GRAY });
  const details = [
    `Signed by: ${input.signerName} <${input.signerEmail}>`,
    `Signed at: ${input.signedAt.toISOString()} (UTC)`,
    `IP address: ${input.ip ?? "unknown"}`,
    `Application: ${input.applicationId}`,
  ];
  details.forEach((d, i) => page.drawText(clean(d), { x: margin + 14, y: y - 120 - i * 12, size: 8.5, font, color: INK }));

  const digest = createHash("sha256").update(`${input.title}|${input.version}|${input.body}`).digest("hex");
  y -= 190;
  ensure(40);
  for (const line of wrap(
    `Document fingerprint (SHA-256): ${digest}. The signer agreed to use an electronic signature, typed their legal name and drew their signature. Browser: ${clean(input.userAgent).slice(0, 160)}`,
    font,
    7.5,
    W - margin * 2,
  )) {
    ensure(10);
    page.drawText(line, { x: margin, y, size: 7.5, font, color: GRAY });
    y -= 10;
  }

  return doc.save();
}
