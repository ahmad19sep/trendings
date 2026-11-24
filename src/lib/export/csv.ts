const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeSpreadsheetFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function csvCell(value: unknown): string {
  const stringValue = escapeSpreadsheetFormula(
    value === null || value === undefined ? "" : String(value),
  );
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function rowsToCsv(rows: readonly (readonly unknown[])[]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

