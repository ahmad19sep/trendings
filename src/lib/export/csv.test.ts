import { describe, expect, it } from "vitest";

import { csvCell, escapeSpreadsheetFormula, rowsToCsv } from "./csv";

describe("CSV export", () => {
  it.each(["=SUM(A1:A2)", "+1", "-2", "@cmd", "\tvalue", "\rvalue"])(
    "escapes spreadsheet formula prefix %s",
    (value) => {
      expect(escapeSpreadsheetFormula(value)).toBe(`'${value}`);
    },
  );

  it("quotes commas and double quotes", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });

  it("emits a UTF-8 BOM and CRLF rows", () => {
    expect(rowsToCsv([["topic", "score"], ["A", 42]])).toBe(
      '\uFEFF"topic","score"\r\n"A","42"\r\n',
    );
  });
});

