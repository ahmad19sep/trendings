import { describe, expect, it } from "vitest";

import { createUpcomingIcsResponse } from "./route";

describe("upcoming.ics route", () => {
  it("returns a sourced curated calendar without trend fixtures", async () => {
    const response = await createUpcomingIcsResponse(
      new Date("2026-11-23T12:00:00.000Z"),
    );
    const calendar = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("x-trend-radar-data-source")).toBe(
      "curated-pakistan-events",
    );
    expect(calendar).toContain("BEGIN:VCALENDAR");
    expect(calendar).toContain("SUMMARY:Quaid-e-Azam Day");
    expect(calendar).not.toContain("DEMO DATA");
  });
});

