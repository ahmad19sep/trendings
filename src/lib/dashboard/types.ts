import type { Category, SupportedLanguage } from "@/domain/taxonomy";
import type { ScoreBreakdownRow } from "@/lib/scoring";

export interface DashboardEvidence {
  title: string;
  source: string | null;
  url: string;
}

export interface DashboardTopic {
  id: string;
  titleOriginal: string;
  titleEnglish: string | null;
  language: SupportedLanguage;
  category: Category;
  score: number;
  scoreExact: number;
  provisional: boolean;
  collectingHistory: boolean;
  scoreBreakdown: ScoreBreakdownRow[];
  firstSeenAt: string;
  ageMinutes: number;
  markets: string[];
  distinctOutletCount: number;
  sourceName: string;
  sourcePosition: number | null;
  approximateTrafficRaw: string | null;
  evidence: DashboardEvidence[];
  url: string;
  riskFlags: string[];
  origin: "live";
}

export interface DashboardResult {
  topics: DashboardTopic[];
  mode: "database" | "live-preview" | "empty";
  fetchedAt: string | null;
  coverage: string[];
  warning: string | null;
}

