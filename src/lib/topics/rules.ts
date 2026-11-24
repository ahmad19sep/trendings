import type { Category, SupportedLanguage } from "@/domain/taxonomy";

const categoryRules: ReadonlyArray<{
  category: Category;
  terms: readonly string[];
}> = [
  {
    category: "Cricket",
    terms: ["cricket", "psl", "ipl", "icc", "test match", "odi", "t20", "wicket"],
  },
  {
    category: "Film & TV",
    terms: ["film", "movie", "cinema", "bollywood", "lollywood", "hollywood", "drama", "netflix"],
  },
  {
    category: "Music",
    terms: ["song", "album", "music", "singer", "concert", "spotify"],
  },
  {
    category: "AI",
    terms: ["artificial intelligence", "chatgpt", "openai", "gemini", "claude", " ai "],
  },
  {
    category: "Tech & Gadgets",
    terms: ["iphone", "android", "phone", "laptop", "gadget", "software", "cyber", "tech"],
  },
  {
    category: "Pakistan Politics",
    terms: ["pakistan", "islamabad", "parliament", "prime minister", "pti", "pml-n", "ppp"],
  },
  {
    category: "India Politics",
    terms: ["india", "delhi", "lok sabha", "bjp", "congress party", "modi"],
  },
  {
    category: "Geopolitics & Conflict",
    terms: ["war", "attack", "military", "ceasefire", "missile", "border", "conflict"],
  },
  {
    category: "Business, Economy & Money",
    terms: ["stock", "market", "economy", "rupee", "dollar", "bank", "inflation", "business"],
  },
  {
    category: "Weather & Disasters",
    terms: ["weather", "earthquake", "flood", "storm", "rain", "cyclone", "heatwave"],
  },
  {
    category: "Health",
    terms: ["health", "disease", "virus", "hospital", "medicine", "vaccine"],
  },
  {
    category: "Science & Space",
    terms: ["space", "nasa", "science", "rocket", "satellite", "research"],
  },
  {
    category: "Education & Exams",
    terms: ["exam", "university", "school", "education", "result", "student"],
  },
  {
    category: "Religion & Culture",
    terms: ["ramadan", "eid", "hajj", "islam", "mosque", "religion", "festival"],
  },
  {
    category: "Other Sports",
    terms: ["football", "fifa", "tennis", "hockey", "olympic", "sport"],
  },
  {
    category: "Celebrities & Influencers",
    terms: ["actor", "actress", "celebrity", "influencer", "youtuber", "tiktoker"],
  },
  {
    category: "Comedy & Viral Moments",
    terms: ["viral video", "went viral", "funny", "comedy"],
  },
];

export function categorizeTitleByRules(title: string): Category {
  const normalized = ` ${title.toLocaleLowerCase("en")} `;
  return (
    categoryRules.find(({ terms }) =>
      terms.some((term) => normalized.includes(term)),
    )?.category ?? "Other/Unclassified"
  );
}

export function detectScriptLanguage(title: string): SupportedLanguage {
  if (/\p{Script=Arabic}/u.test(title)) return "ur";
  if (/\p{Script=Devanagari}/u.test(title)) return "hi";
  return "unknown";
}

export function ruleShelfLife(category: Category): "flash" | "short" | "lasting" {
  if (
    category === "Internet Culture & Memes" ||
    category === "Comedy & Viral Moments" ||
    category === "Celebrities & Influencers"
  ) {
    return "flash";
  }

  if (
    category === "Science & Space" ||
    category === "Education & Exams" ||
    category === "Health" ||
    category === "Everyday Life & Consumer"
  ) {
    return "lasting";
  }

  return "short";
}

