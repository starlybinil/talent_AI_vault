/** Minimal iCalendar (RFC 5545) all-day event for a cohort's start date. */
export function buildIcs(
  programName: string,
  cohort: { name: string; start_date: string; end_date: string; schedule: string; location: string; address: string | null },
): string {
  const d = (s: string) => s.replace(/-/g, "");
  const esc = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const start = d(cohort.start_date);
  const next = new Date(`${cohort.start_date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FoundryReady//Training Programs//EN",
    "BEGIN:VEVENT",
    `UID:${start}-${Math.random().toString(36).slice(2)}@foundryready.org`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(`${programName} — first day (${cohort.name})`)}`,
    `LOCATION:${esc([cohort.location, cohort.address].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc(`Schedule: ${cohort.schedule}. Program runs ${cohort.start_date} to ${cohort.end_date}.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
