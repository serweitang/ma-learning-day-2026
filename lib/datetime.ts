const SGT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: "Asia/Singapore",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

/**
 * Formats an ISO date string or `Date` for display in Singapore time (UTC+8).
 */
export function formatSgt(date: Date | string | number | null | undefined): string {
  if (date == null) return "—";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-SG", SGT_OPTIONS).format(d);
}
