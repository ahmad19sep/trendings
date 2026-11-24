import { KeyRound, LogOut, ShieldCheck, WalletCards } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { PageShell } from "@/components/page-shell";
import { ScoreSettings } from "@/components/settings/score-settings";
import { Badge } from "@/components/ui/badge";
import { isDatabaseConfigured } from "@/db/client";
import { requireSession } from "@/lib/auth";
import { DEFAULT_SCORE_WEIGHTS, type ScoreWeights } from "@/lib/scoring";
import { loadScoreWeights } from "@/lib/settings/score-weights";

const sourceCards = [
  {
    name: "Google Trends RSS",
    access: "Public · undocumented",
    status: "Live preview verified",
    tone: "accent" as const,
    detail: "PK, IN, US, GB, AE, SA · every 30 min · snapshots retained",
  },
  {
    name: "Google News RSS",
    access: "Personal-use feed",
    status: "Connector verified",
    tone: "accent" as const,
    detail: "en-PK, en-IN, hi-IN, en-US · Urdu-PK is unsupported",
  },
  {
    name: "Publisher RSS",
    access: "Public feeds",
    status: "Connector verified",
    tone: "accent" as const,
    detail: "Dawn, Express Tribune, Jang, The Nation, BBC English/Urdu/Hindi",
  },
  {
    name: "GDELT DOC 2.0",
    access: "Free · attribution",
    status: "Not implemented yet",
    tone: "warning" as const,
    detail: "Conservative pacing required; current RPS/window are not contractual",
  },
  {
    name: "YouTube Data API",
    access: "Free quota · API key",
    status: "Waiting for connector and key",
    tone: "warning" as const,
    detail: "Music/movies/gaming chart only; metrics stay outside scoring",
  },
  {
    name: "Upcoming sources",
    access: "Free + credentialed",
    status: "Curated calendar active",
    tone: "info" as const,
    detail: "AlAdhan, Nager v4, CricketData, TMDB and Wikipedia connectors remain",
  },
];

const paidItems = [
  ["Provider AI", "AI_MODE=provider", "$0 cap", "Paid — user decides"],
  ["X trends", "SRC_X_TRENDS", "$0 cap", "Paid — user decides"],
  ["Reddit", "SRC_REDDIT", "Off", "Approval required"],
  ["Instagram hashtag watch", "SRC_INSTAGRAM", "Off", "Approval required"],
  ["Google Trends API alpha", "SRC_GTRENDS_API", "Off", "Approval required"],
  ["YouTube quota increase", "—", "Off", "Approval required"],
  ["Calendarific", "SRC_CALENDARIFIC", "$0 cap", "Free tier / paid"],
  ["Resend email", "DIGEST_EMAIL", "$0 cap", "Free tier / paid"],
  ["WhatsApp digest", "DIGEST_WHATSAPP", "$0 cap", "Paid + approval"],
] as const;

export default async function SettingsPage() {
  const session = await requireSession();
  let persistenceAvailable = isDatabaseConfigured();
  let scoreWeights: ScoreWeights = { ...DEFAULT_SCORE_WEIGHTS };
  if (persistenceAvailable) {
    try {
      scoreWeights = await loadScoreWeights();
    } catch (error) {
      persistenceAvailable = false;
      console.error("Unable to load score weights", {
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  return (
    <PageShell
      eyebrow="Control room"
      title="Sources, scoring, and safeguards"
      description="Every connector exposes its real coverage, state, limits, and cost boundary. Missing credentials remain missing—not simulated."
      actions={
        <form action={logoutAction}>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-muted)]">
            <LogOut aria-hidden="true" size={16} />
            Sign out {session.displayName}
          </button>
        </form>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" size={19} className="text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-[var(--ink)]">Source health</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sourceCards.map((source) => (
              <article key={source.name} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[var(--ink)]">{source.name}</h3>
                  <Badge tone={source.tone}>{source.status}</Badge>
                </div>
                <p className="mt-2 text-xs font-semibold text-[var(--ink-faint)]">{source.access}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{source.detail}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3 text-xs">
                  <div><dt className="text-[var(--ink-faint)]">Last stored run</dt><dd className="mt-1 font-semibold text-[var(--ink)]">Not yet</dd></div>
                  <div><dt className="text-[var(--ink-faint)]">Next run</dt><dd className="mt-1 font-semibold text-[var(--ink)]">Worker setup</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
          <ScoreSettings
            initialWeights={scoreWeights}
            persistenceAvailable={persistenceAvailable}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <KeyRound aria-hidden="true" size={18} className="text-[var(--accent)]" />
              <h2 className="text-lg font-semibold text-[var(--ink)]">Credentials</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              Credentials are write-only and encrypted with AES-256-GCM under APP_ENCRYPTION_KEY. No key is configured in this repository.
            </p>
            <div className="mt-4 space-y-3">
              {["YouTube API key", "TMDB token", "CricketData key", "Telegram bot token"].map((label) => (
                <label key={label} className="block text-sm font-semibold text-[var(--ink)]">
                  {label}
                  <input
                    type="password"
                    disabled
                    value=""
                    placeholder="Not configured"
                    className="mt-2 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--ink-faint)] disabled:cursor-not-allowed"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <WalletCards aria-hidden="true" size={18} className="text-[var(--accent)]" />
              <h2 className="text-lg font-semibold text-[var(--ink)]">AI and budget</h2>
            </div>
            <div className="mt-4 rounded-xl bg-[var(--accent-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-semibold text-[var(--ink)]">AI mode: off</p><p className="mt-1 text-xs text-[var(--ink-muted)]">Rules-only scoring · no summaries · no AI flags</p></div>
                <Badge tone="accent">$0.00 spent</Badge>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[var(--line)] p-3"><dt className="text-[var(--ink-faint)]">Monthly cap</dt><dd className="mt-1 font-semibold text-[var(--ink)]">$0.00</dd></div>
              <div className="rounded-xl border border-[var(--line)] p-3"><dt className="text-[var(--ink-faint)]">Provider calls</dt><dd className="mt-1 font-semibold text-[var(--ink)]">0</dd></div>
            </dl>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-[var(--ink)]">Phase 2 decisions</h2><p className="mt-1 text-sm text-[var(--ink-muted)]">No item is approved. Every flag and cap remains off.</p></div>
            <Badge tone="warning">User decides</Badge>
          </div>
          <div className="scrollbar-thin mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-[var(--ink-faint)]"><tr><th className="pb-3 pr-5">Item</th><th className="pb-3 pr-5">Flag</th><th className="pb-3 pr-5">Cap/state</th><th className="pb-3">Decision</th></tr></thead>
              <tbody className="divide-y divide-[var(--line)]">
                {paidItems.map(([item, flag, cap, decision]) => (
                  <tr key={item}><td className="py-3 pr-5 font-semibold text-[var(--ink)]">{item}</td><td className="py-3 pr-5 font-mono text-xs text-[var(--ink-muted)]">{flag}</td><td className="py-3 pr-5 text-[var(--ink-muted)]">{cap}</td><td className="py-3"><Badge tone="warning">{decision}</Badge></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

