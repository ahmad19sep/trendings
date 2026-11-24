import { describe, expect, it } from "vitest";

import { safeReturnPath } from "./redirect";

describe("safeReturnPath", () => {
  it("keeps local paths and query strings", () => {
    expect(safeReturnPath("/compare?market=PK")).toBe("/compare?market=PK");
  });

  it.each([
    null,
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example",
    "/login?next=/",
  ])("falls back for unsafe destination %s", (value) => {
    expect(safeReturnPath(value)).toBe("/");
  });
});

