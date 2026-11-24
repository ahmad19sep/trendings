import { describe, expect, it } from "vitest";

import {
  ALADHAN_LUNAR_CAVEAT,
  computePreBuzz,
  createExpectedLunarEvent,
  dateInTimeZone,
  escapeIcsText,
  foldIcsLine,
  generateUpcomingCalendar,
  karachiLocalMidnightToUtc,
  materializeCuratedEvents,
  parseCuratedEventsYaml,
  type CuratedEventSeed,
  type UpcomingEvent,
} from ".";

const seed: CuratedEventSeed = {
  key: "pakistan-day",
  title: "Pakistan Day",
  category: "Religion & Culture",
  month: 3,
  day: 23,
  allDay: true,
  recurrence: "yearly",
  markets: ["PK"],
  confidence: "confirmed",
  sourceUrl: "https://example.com/source",
  lastVerifiedAt: "2026-11-23",
};

describe("curated event materialization", () => {
  it("materializes yearly dates inclusively in Asia/Karachi", () => {
    const events = materializeCuratedEvents([seed], {
      from: new Date("2026-03-22T19:00:00.000Z"),
      to: new Date("2027-03-23T18:59:59.000Z"),
    });

    expect(events.map((event) => event.localDate)).toEqual([
      "2026-03-23",
      "2027-03-23",
    ]);
    expect(events[0]?.startsAt.toISOString()).toBe("2026-03-22T19:00:00.000Z");
  });

  it("converts Karachi local midnight to the correct UTC instant", () => {
    const instant = karachiLocalMidnightToUtc(2026, 8, 14);
    expect(instant.toISOString()).toBe("2026-08-13T19:00:00.000Z");
    expect(dateInTimeZone(instant, "Asia/Karachi")).toBe("2026-08-14");
  });

  it("parses and validates injected YAML", () => {
    const parsed = parseCuratedEventsYaml(`
- key: test-day
  title: Test Day
  category: Education & Exams
  month: 4
  day: 10
  all_day: true
  recurrence: yearly
  markets: [PK]
  confidence: reported
  source_url: https://example.com/source
  last_verified_at: 2026-11-23
`);
    expect(parsed[0]).toMatchObject({ key: "test-day", sourceUrl: "https://example.com/source" });
  });
});

describe("pre-buzz", () => {
  it("marks a >=2 ratio with at least five recent mentions as Rising", () => {
    expect(
      computePreBuzz({ recentMentions: 8, previousMentions: 4 }),
    ).toMatchObject({ status: "Rising", ratio: 2, baselineAvailable: true });
  });

  it("marks a >=1.3 ratio as Building", () => {
    expect(
      computePreBuzz({ recentMentions: 4, previousMentions: 3 }),
    ).toMatchObject({ status: "Building", ratio: 1.33 });
  });

  it("does not invent a ratio without a complete baseline", () => {
    expect(
      computePreBuzz({
        recentMentions: 20,
        previousMentions: null,
        previousWindowComplete: false,
      }),
    ).toMatchObject({
      status: "Collecting history",
      ratio: null,
      ratioLabel: "Not available",
      baselineAvailable: false,
    });
  });

  it("labels a complete zero baseline without serializing Infinity", () => {
    expect(
      computePreBuzz({ recentMentions: 5, previousMentions: 0 }),
    ).toMatchObject({
      status: "Rising",
      ratio: null,
      ratioLabel: "New (0 baseline)",
      baselineAvailable: true,
    });
  });
});

describe("expected lunar dates", () => {
  it("always carries the calculated moon-sighting caveat", () => {
    const lunar = createExpectedLunarEvent({
      id: "eid-2027",
      title: "Eid ul-Fitr",
      category: "Religion & Culture",
      markets: ["PK"],
      startsAt: new Date("2027-03-09T19:00:00.000Z"),
      localDate: "2027-03-10",
      allDay: true,
      timezone: "Asia/Karachi",
      datePrecision: "estimated",
      sourceUrls: ["https://aladhan.com/islamic-calendar-api"],
      status: "scheduled",
    });
    expect(lunar.confidence).toBe("expected_lunar");
    expect(lunar.confidenceLabel).toContain("±2 days");
    expect(lunar.caveat).toBe(ALADHAN_LUNAR_CAVEAT);
  });
});

describe("iCalendar generation", () => {
  const allDayEvent: UpcomingEvent = {
    id: "event-1",
    title: "Launch, briefing; and Q&A",
    category: "Tech & Gadgets",
    markets: ["PK"],
    startsAt: new Date("2026-11-24T19:00:00.000Z"),
    localDate: "2026-11-25",
    allDay: true,
    timezone: "Asia/Karachi",
    datePrecision: "day",
    confidence: "confirmed",
    confidenceLabel: "Confirmed",
    sourceUrls: ["https://example.com/event"],
    status: "scheduled",
  };

  it("escapes text and emits exclusive all-day DTEND", () => {
    const calendar = generateUpcomingCalendar([allDayEvent], {
      generatedAt: new Date("2026-11-23T12:00:00.000Z"),
    });
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(calendar).toContain("DTSTART;VALUE=DATE:20261125\r\n");
    expect(calendar).toContain("DTEND;VALUE=DATE:20261126\r\n");
    expect(calendar).toContain("SUMMARY:Launch\\, briefing\\; and Q&A\r\n");
    expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("emits timed events as UTC", () => {
    const timed: UpcomingEvent = {
      ...allDayEvent,
      id: "timed",
      allDay: false,
      localDate: null,
      startsAt: new Date("2026-11-25T04:30:00.000Z"),
      endsAt: new Date("2026-11-25T05:30:00.000Z"),
    };
    const calendar = generateUpcomingCalendar([timed], {
      generatedAt: new Date("2026-11-23T12:00:00.000Z"),
    });
    expect(calendar).toContain("DTSTART:20261125T043000Z\r\n");
    expect(calendar).toContain("DTEND:20261125T053000Z\r\n");
  });

  it("folds every physical line to at most 75 UTF-8 octets", () => {
    const lines = foldIcsLine(`SUMMARY:${"اردو".repeat(40)}`);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(lines.slice(1).every((line) => line.startsWith(" "))).toBe(true);
  });
});

