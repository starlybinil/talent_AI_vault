import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = "America/Phoenix";

export function formatDate(value: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00` : value) : value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ, ...opts });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** Map a Postgres/Supabase error to a user-facing message. */
export function errorMessage(error: unknown): string {
  if (!error) return "Something went wrong.";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    const msg = String((error as { message: unknown }).message);
    if (msg.includes("duplicate key") && msg.includes("applications_program_id_user_id")) {
      return "You've already applied to this program.";
    }
    if (msg.includes("degree_needs_major")) return "Please enter the major for your degree.";
    return msg;
  }
  return "Something went wrong.";
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = Array.isArray(value) ? value.join("; ") : String(value);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\r\n");
}

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/portal"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
