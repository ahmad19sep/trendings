import type { SupportedLanguage } from "@/domain/taxonomy";

export type ReadableTitle = {
  text: string;
  language: SupportedLanguage;
  romanized: boolean;
};

const DEVANAGARI_PATTERN = /[\u0900-\u097f]/u;
const DEVANAGARI_RUN_PATTERN = /[\u0900-\u097f]+/gu;
const ARABIC_PATTERN = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u;
const ARABIC_RUN_PATTERN = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+/gu;
const LATIN_PATTERN = /\p{Script=Latin}/u;

const DEVANAGARI_INDEPENDENT_VOWELS: Record<string, string> = {
  अ: "a",
  आ: "aa",
  इ: "i",
  ई: "ee",
  उ: "u",
  ऊ: "oo",
  ऋ: "ri",
  ॠ: "ri",
  ऌ: "li",
  ए: "e",
  ऐ: "ai",
  ओ: "o",
  औ: "au",
  ऍ: "ae",
  ऑ: "o",
  ऎ: "e",
  ऒ: "o",
};

const DEVANAGARI_VOWEL_SIGNS: Record<string, string> = {
  "ा": "aa",
  "ि": "i",
  "ी": "ee",
  "ु": "u",
  "ू": "oo",
  "ृ": "ri",
  "ॄ": "ri",
  "ॢ": "li",
  "ॣ": "li",
  "े": "e",
  "ै": "ai",
  "ो": "o",
  "ौ": "au",
  "ॅ": "ae",
  "ॉ": "o",
  "ॆ": "e",
  "ॊ": "o",
};

const DEVANAGARI_CONSONANTS: Record<string, string> = {
  क: "k",
  ख: "kh",
  ग: "g",
  घ: "gh",
  ङ: "ng",
  च: "ch",
  छ: "chh",
  ज: "j",
  झ: "jh",
  ञ: "n",
  ट: "t",
  ठ: "th",
  ड: "d",
  ढ: "dh",
  ण: "n",
  त: "t",
  थ: "th",
  द: "d",
  ध: "dh",
  न: "n",
  प: "p",
  फ: "ph",
  ब: "b",
  भ: "bh",
  म: "m",
  य: "y",
  र: "r",
  ल: "l",
  व: "v",
  श: "sh",
  ष: "sh",
  स: "s",
  ह: "h",
  ळ: "l",
  ऱ: "r",
  क़: "q",
  ख़: "kh",
  ग़: "gh",
  ज़: "z",
  ड़: "r",
  ढ़: "rh",
  फ़: "f",
  य़: "y",
};

const DEVANAGARI_NUKTA_CONSONANTS: Record<string, string> = {
  क: "q",
  ख: "kh",
  ग: "gh",
  ज: "z",
  ड: "r",
  ढ: "rh",
  फ: "f",
  य: "y",
  र: "r",
};

const DEVANAGARI_MARKS: Record<string, string> = {
  "ँ": "n",
  "ं": "n",
  "ः": "h",
  "ऽ": "'",
};

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

const DEVANAGARI_WORD_OVERRIDES: ReadonlyArray<readonly [string, string]> = [
  ["में", "mein"],
  ["और", "aur"],
  ["है", "hai"],
  ["नई", "nayi"],
];

const ARABIC_CHARACTERS: Record<string, string> = {
  ء: "'",
  آ: "aa",
  أ: "a",
  إ: "i",
  ا: "a",
  ب: "b",
  پ: "p",
  ت: "t",
  ٹ: "t",
  ث: "s",
  ج: "j",
  چ: "ch",
  ح: "h",
  خ: "kh",
  د: "d",
  ڈ: "d",
  ذ: "z",
  ر: "r",
  ڑ: "r",
  ز: "z",
  ژ: "zh",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "z",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ک: "k",
  گ: "g",
  ل: "l",
  م: "m",
  ن: "n",
  ں: "n",
  و: "o",
  ؤ: "o",
  ه: "h",
  ہ: "h",
  ھ: "h",
  ة: "h",
  ي: "i",
  ی: "i",
  ى: "a",
  ے: "e",
  ۓ: "e",
  ئ: "y",
  "َ": "a",
  "ِ": "i",
  "ُ": "u",
  "ٰ": "aa",
  "ْ": "",
  "ـ": "",
  "،": ",",
  "؛": ";",
  "؟": "?",
};

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

const URDU_WORD_OVERRIDES: ReadonlyArray<readonly [string, string]> = [
  ["پاکستان", "pakistan"],
  ["سپر", "super"],
  ["لیگ", "league"],
  ["کرکٹ", "cricket"],
  ["میچ", "match"],
  ["خبریں", "khabrein"],
  ["خبر", "khabar"],
  ["میں", "mein"],
  ["اور", "aur"],
  ["ہے", "hai"],
];

function replaceWords(
  value: string,
  replacements: ReadonlyArray<readonly [string, string]>,
): string {
  return replacements.reduce(
    (current, [source, replacement]) => current.replaceAll(source, replacement),
    value,
  );
}

function isDevanagariContinuation(value: string | undefined): boolean {
  if (!value) return false;
  return Boolean(
    DEVANAGARI_CONSONANTS[value] ||
      DEVANAGARI_INDEPENDENT_VOWELS[value] ||
      Object.hasOwn(DEVANAGARI_VOWEL_SIGNS, value) ||
      DEVANAGARI_MARKS[value] ||
      value === "़" ||
      value === "्",
  );
}

function romanizeDevanagariRun(value: string): string {
  const characters = [...value.normalize("NFC")];
  let output = "";

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    let consonant = DEVANAGARI_CONSONANTS[character];

    if (consonant) {
      if (characters[index + 1] === "़") {
        consonant = DEVANAGARI_NUKTA_CONSONANTS[character] ?? consonant;
        index += 1;
      }

      const following = characters[index + 1];
      if (following === "्") {
        output += consonant;
        index += 1;
        continue;
      }

      if (
        following &&
        Object.hasOwn(DEVANAGARI_VOWEL_SIGNS, following)
      ) {
        output += consonant + DEVANAGARI_VOWEL_SIGNS[following];
        index += 1;
        continue;
      }

      output +=
        consonant + (isDevanagariContinuation(following) ? "a" : "");
      continue;
    }

    if (DEVANAGARI_INDEPENDENT_VOWELS[character]) {
      output += DEVANAGARI_INDEPENDENT_VOWELS[character];
      continue;
    }
    if (Object.hasOwn(DEVANAGARI_VOWEL_SIGNS, character)) {
      output += DEVANAGARI_VOWEL_SIGNS[character];
      continue;
    }
    if (DEVANAGARI_MARKS[character]) {
      output += DEVANAGARI_MARKS[character];
      continue;
    }
    if (DEVANAGARI_DIGITS[character]) {
      output += DEVANAGARI_DIGITS[character];
      continue;
    }
    if (character === "।" || character === "॥") {
      output += ".";
      continue;
    }
    if (character !== "़" && character !== "्") output += character;
  }

  return output;
}

function romanizeDevanagari(value: string): string {
  const withCommonWords = replaceWords(
    value.normalize("NFC"),
    DEVANAGARI_WORD_OVERRIDES,
  );
  return withCommonWords.replace(
    DEVANAGARI_RUN_PATTERN,
    romanizeDevanagariRun,
  );
}

function romanizeArabicRun(value: string): string {
  const characters = [...value.normalize("NFC")];
  let output = "";
  let previousRomanLetter = "";

  for (const character of characters) {
    if (character === "ّ") {
      output += previousRomanLetter;
      continue;
    }

    const mapped = ARABIC_CHARACTERS[character] ?? ARABIC_DIGITS[character];
    if (mapped !== undefined) {
      output += mapped;
      if (/^[a-z]+$/i.test(mapped)) previousRomanLetter = mapped;
      continue;
    }

    output += character;
    previousRomanLetter = "";
  }

  return output;
}

function romanizeArabic(value: string): string {
  const withCommonWords = replaceWords(
    value.normalize("NFC"),
    URDU_WORD_OVERRIDES,
  );
  return withCommonWords.replace(ARABIC_RUN_PATTERN, romanizeArabicRun);
}

function normalizeRomanized(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

export function getReadableTitle(
  titleOriginal: string,
  titleEnglish?: string | null,
): ReadableTitle {
  const english = titleEnglish?.trim();
  if (english) {
    return { text: english, language: "en", romanized: false };
  }

  const hasDevanagari = DEVANAGARI_PATTERN.test(titleOriginal);
  const hasArabic = ARABIC_PATTERN.test(titleOriginal);
  if (hasDevanagari || hasArabic) {
    let text = titleOriginal;
    if (hasDevanagari) text = romanizeDevanagari(text);
    if (hasArabic) text = romanizeArabic(text);
    return {
      text: normalizeRomanized(text),
      language: hasDevanagari ? "hi-Latn" : "ur-Latn",
      romanized: true,
    };
  }

  if (LATIN_PATTERN.test(titleOriginal)) {
    return { text: titleOriginal, language: "en", romanized: false };
  }

  return { text: titleOriginal, language: "unknown", romanized: false };
}
