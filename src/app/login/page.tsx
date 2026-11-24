import { Suspense } from "react";
import { Database, Radar, ShieldCheck } from "lucide-react";

import { getAuthConfiguration } from "@/lib/auth/configuration";
import { safeReturnPath } from "@/lib/auth/redirect";

import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in · Creator Trend Radar",
  description: "Sign in to your private Creator Trend Radar workspace.",
};

type LoginSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default function LoginPage(props: {
  searchParams: LoginSearchParams;
}) {
  return (
    <main className="relative min-h-svh overflow-hidden bg-slate-50 text-slate-950 dark:bg-[#07110f] dark:text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(13,148,136,0.13),transparent_34%),radial-gradient(circle_at_88%_5%,rgba(245,158,11,0.10),transparent_28%)]"
      />
      <div className="relative mx-auto grid min-h-svh w-full max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="hidden max-w-xl lg:block" aria-labelledby="login-intro">
          <div className="mb-8 flex size-14 items-center justify-center rounded-2xl border border-teal-700/15 bg-teal-600 text-white shadow-lg shadow-teal-950/10 dark:border-teal-300/20 dark:bg-teal-400 dark:text-slate-950">
            <Radar aria-hidden="true" className="size-7" />
          </div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
            Creator Trend Radar
          </p>
          <h1
            className="max-w-lg text-balance text-5xl font-semibold leading-[1.06] tracking-[-0.04em]"
            id="login-intro"
          >
            Signals, evidence, and timing—without the noise.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600 dark:text-slate-300">
            Your private view of what is gaining attention across Pakistan,
            South Asia, and the wider world. You decide what is worth making.
          </p>
          <div className="mt-10 grid max-w-lg gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
              <ShieldCheck
                aria-hidden="true"
                className="mb-3 size-5 text-teal-700 dark:text-teal-300"
              />
              <p className="text-sm font-semibold">Private by default</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Secure session cookies and server-side authorization protect
                every workspace route.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
              <Database
                aria-hidden="true"
                className="mb-3 size-5 text-amber-600 dark:text-amber-300"
              />
              <p className="text-sm font-semibold">Evidence stays visible</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Scores preserve their source inputs, history, and uncertainty.
              </p>
            </div>
          </div>
        </section>

        <Suspense fallback={<LoginCardFallback />}>
          <LoginCard searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginCard({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = safeReturnPath(rawNext ?? null);
  const configuration = await getAuthConfiguration();

  return (
    <section
      aria-labelledby="sign-in-heading"
      className="mx-auto w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white/95 p-6 shadow-2xl shadow-slate-900/[0.08] backdrop-blur sm:p-8 dark:border-white/10 dark:bg-[#0c1816]/95 dark:shadow-black/30"
    >
      <div className="mb-7 flex items-center gap-3 lg:hidden">
        <span className="flex size-10 items-center justify-center rounded-xl bg-teal-600 text-white dark:bg-teal-400 dark:text-slate-950">
          <Radar aria-hidden="true" className="size-5" />
        </span>
        <span className="text-sm font-semibold">Creator Trend Radar</span>
      </div>

      <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
        Private workspace
      </p>
      <h2
        className="mt-2 text-3xl font-semibold tracking-[-0.035em]"
        id="sign-in-heading"
      >
        Welcome back
      </h2>
      <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
        Sign in to review today&apos;s trend evidence and upcoming moments.
      </p>

      <LoginForm
        disabled={!configuration.readyForLogin}
        nextPath={nextPath}
      />

      {configuration.issues.length ? (
        <aside className="mt-6 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-950 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
          <p className="text-sm font-semibold">First-run setup needed</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
            {configuration.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 opacity-80">
            Values belong in your server environment. They are never shown in
            this page or sent to the browser.
          </p>
        </aside>
      ) : null}

      <p className="mt-7 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500 dark:border-white/10 dark:text-slate-400">
        Passwords are verified with Argon2id. The session is limited to seven
        days and can be revoked from the server.
      </p>
    </section>
  );
}

function LoginCardFallback() {
  return (
    <div
      aria-label="Loading sign-in"
      className="mx-auto h-[31rem] w-full max-w-md animate-pulse rounded-[1.75rem] border border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]"
      role="status"
    />
  );
}

