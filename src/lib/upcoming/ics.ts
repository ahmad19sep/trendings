import type { UpcomingEvent } from "./types";

const CRLF = "\r\n";

export function generateUpcomingCalendar(
  events: UpcomingEvent[],
  options?: {
    generatedAt?: Date;
    calendarName?: string;
  },
): string {
  const generatedAt = options?.generatedAt ?? new Date();
  const calendarName = options?.calendarName ?? "Creator Trend Radar — Upcoming";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Creator Trend Radar//Upcoming Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "X-WR-TIMEZONE:Asia/Karachi",
  ];

  for (const event of events) {
    lines.push(...eventToIcsLines(event, generatedAt));
  }
  lines.push("END:VCALENDAR");

  return `${lines.flatMap(foldIcsLine).join(CRLF)}${CRLF}`;
}

export function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(/\r\n|\r|\n/g, "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

/** Fold an iCalendar content line at 75 UTF-8 octets with RFC continuation. */
export function foldIcsLine(line: string): string[] {
  const folded: string[] = [];
  let current = "";
  let byteLimit = 75;

  for (const character of line) {
    const candidate = current + character;
    if (Buffer.byteLength(candidate, "utf8") > byteLimit && current) {
      folded.push(folded.length === 0 ? current : ` ${current}`);
      current = character;
      byteLimit = 74;
    } else {
      current = candidate;
    }
  }
  folded.push(folded.length === 0 ? current : ` ${current}`);
  return folded;
}

function eventToIcsLines(event: UpcomingEvent, generatedAt: Date): string[] {
  const descriptionParts = [
    `Confidence: ${event.confidenceLabel}`,
    event.caveat ?? null,
    event.sourceUrls.length > 0
      ? `Sources: ${event.sourceUrls.join(" | ")}`
      : null,
  ].filter((part): part is string => Boolean(part));
  const uid = `${event.id.replaceAll(/[^a-zA-Z0-9._-]/g, "-")}@creator-trend-radar.local`;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatUtcDateTime(generatedAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`,
    `CATEGORIES:${escapeIcsText(event.category)}`,
    `X-TREND-RADAR-CONFIDENCE:${event.confidence}`,
    `STATUS:${icsStatus(event.status)}`,
  ];

  if (event.allDay) {
    const localDate = event.localDate;
    if (!localDate) {
      throw new Error(`All-day event ${event.id} is missing localDate.`);
    }
    lines.push(`DTSTART;VALUE=DATE:${formatBasicDate(localDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatBasicDate(addLocalDays(localDate, 1))}`);
  } else {
    lines.push(`DTSTART:${formatUtcDateTime(event.startsAt)}`);
    if (event.endsAt) lines.push(`DTEND:${formatUtcDateTime(event.endsAt)}`);
  }

  if (event.sourceUrls[0]) lines.push(`URL:${event.sourceUrls[0]}`);
  lines.push("END:VEVENT");
  return lines;
}

function formatUtcDateTime(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid calendar date.");
  return date
    .toISOString()
    .replaceAll(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatBasicDate(localDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new TypeError(`Invalid local date: ${localDate}`);
  }
  return localDate.replaceAll("-", "");
}

function addLocalDays(localDate: string, amount: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function icsStatus(status: UpcomingEvent["status"]): string {
  if (status === "cancelled") return "CANCELLED";
  if (status === "postponed") return "TENTATIVE";
  return "CONFIRMED";
}

