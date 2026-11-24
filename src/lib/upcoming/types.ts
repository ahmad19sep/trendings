export const eventConfidences = [
  "confirmed",
  "reported",
  "ai_extracted",
  "expected_lunar",
] as const;

export type EventConfidence = (typeof eventConfidences)[number];

export const eventStatuses = [
  "scheduled",
  "postponed",
  "cancelled",
  "done",
] as const;

export type EventStatus = (typeof eventStatuses)[number];

export type UpcomingEvent = {
  id: string;
  title: string;
  titleUr?: string | null;
  titleHi?: string | null;
  category: string;
  markets: string[];
  startsAt: Date;
  endsAt?: Date | null;
  /** Local calendar date for all-day events, in the event timezone. */
  localDate?: string | null;
  allDay: boolean;
  timezone: string;
  datePrecision: "exact" | "day" | "month" | "estimated";
  confidence: EventConfidence;
  confidenceLabel: string;
  sourceUrls: string[];
  recurrence?: string | null;
  status: EventStatus;
  lastVerifiedAt?: Date | null;
  caveat?: string | null;
};

export type CuratedEventSeed = {
  key: string;
  title: string;
  category: string;
  month: number;
  day: number;
  allDay: true;
  recurrence: "yearly";
  markets: string[];
  confidence: Extract<EventConfidence, "confirmed" | "reported">;
  sourceUrl: string;
  lastVerifiedAt: string;
};

export const ALADHAN_LUNAR_CAVEAT =
  "Calculated date from AlAdhan; expected and moon-sighting dependent, with possible variation of up to ±2 days.";

export const confidenceLabels: Record<EventConfidence, string> = {
  confirmed: "Confirmed",
  reported: "Reported",
  ai_extracted: "AI-extracted",
  expected_lunar:
    "Expected (calculated; moon-sighting dependent, up to ±2 days)",
};

export function createExpectedLunarEvent(
  event: Omit<
    UpcomingEvent,
    "confidence" | "confidenceLabel" | "caveat"
  >,
): UpcomingEvent {
  return {
    ...event,
    confidence: "expected_lunar",
    confidenceLabel: confidenceLabels.expected_lunar,
    caveat: ALADHAN_LUNAR_CAVEAT,
  };
}

