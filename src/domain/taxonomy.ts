export const categories = [
  "World News",
  "Pakistan Politics",
  "India Politics",
  "Geopolitics & Conflict",
  "Cricket",
  "Other Sports",
  "Film & TV",
  "Music",
  "Celebrities & Influencers",
  "Internet Culture & Memes",
  "Comedy & Viral Moments",
  "Tech & Gadgets",
  "AI",
  "Business, Economy & Money",
  "Science & Space",
  "Health",
  "Education & Exams",
  "Religion & Culture",
  "Society & Crime",
  "Law & Courts",
  "Weather & Disasters",
  "Everyday Life & Consumer",
  "Other/Unclassified",
] as const;

export type Category = (typeof categories)[number];

export const supportedLanguages = [
  "en",
  "ur",
  "ur-Latn",
  "hi",
  "hi-Latn",
  "other",
  "unknown",
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const riskFlagTypes = [
  "defamation_risk",
  "graphic_content",
  "religious_sensitivity",
  "misinformation_risk",
  "platform_policy_risk",
  "legal_sub_judice",
  "unverified_viral_media",
] as const;

export type RiskFlagType = (typeof riskFlagTypes)[number];

