import { describe, expect, it } from "vitest";

import { getReadableTitle } from "./readable-title";

describe("getReadableTitle", () => {
  it("prefers a non-empty English alternative", () => {
    expect(
      getReadableTitle("भारत में चुनाव", "  Election in India  "),
    ).toEqual({
      text: "Election in India",
      language: "en",
      romanized: false,
    });
  });

  it("keeps an existing Latin title unchanged", () => {
    expect(getReadableTitle("PSL 2026 final")).toEqual({
      text: "PSL 2026 final",
      language: "en",
      romanized: false,
    });
  });

  it("romanizes Devanagari vowels, matras, and common words", () => {
    expect(getReadableTitle("भारत में चुनाव")).toEqual({
      text: "bhaarat mein chunaav",
      language: "hi-Latn",
      romanized: true,
    });
  });

  it("honors virama in Devanagari consonant clusters", () => {
    expect(getReadableTitle("क्रिकेट मैच").text).toBe("kriket maich");
  });

  it("supports decomposed nukta characters", () => {
    expect(getReadableTitle("ज़फ़र और फ़िल्म").text).toBe(
      "zafar aur film",
    );
  });

  it("preserves mixed Latin text and converts Devanagari digits", () => {
    expect(getReadableTitle("IPL २०२६: भारत")).toEqual({
      text: "IPL 2026: bhaarat",
      language: "hi-Latn",
      romanized: true,
    });
  });

  it("provides readable common Roman Urdu forms", () => {
    expect(getReadableTitle("پاکستان سپر لیگ")).toEqual({
      text: "pakistan super league",
      language: "ur-Latn",
      romanized: true,
    });
  });

  it("converts Urdu words, punctuation, and Eastern Arabic digits", () => {
    expect(getReadableTitle("کرکٹ میچ ۲۰۲۶؟").text).toBe(
      "cricket match 2026?",
    );
  });

  it("preserves mixed Latin and Urdu text", () => {
    expect(getReadableTitle("PSL: پاکستان")).toEqual({
      text: "PSL: pakistan",
      language: "ur-Latn",
      romanized: true,
    });
  });

  it("ignores an empty English alternative", () => {
    expect(getReadableTitle("भारत", "   ")).toEqual({
      text: "bhaarat",
      language: "hi-Latn",
      romanized: true,
    });
  });

  it("falls back without altering unsupported scripts", () => {
    expect(getReadableTitle("東京 2026")).toEqual({
      text: "東京 2026",
      language: "unknown",
      romanized: false,
    });
  });
});
