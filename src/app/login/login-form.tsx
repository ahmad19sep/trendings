"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";

import { loginAction } from "@/app/actions/auth";
import { initialLoginState } from "@/lib/auth/login-state";

export function LoginForm({
  nextPath,
  disabled,
}: {
  nextPath: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    loginAction,
    initialLoginState,
  );

  return (
    <form action={action} className="mt-8 space-y-5">
      <input name="next" type="hidden" value={nextPath} />

      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            autoComplete="current-password"
            autoFocus
            className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:focus:border-teal-400 dark:focus:ring-teal-400/15 dark:disabled:bg-white/[0.03]"
            disabled={disabled || pending}
            id="password"
            maxLength={512}
            name="password"
            placeholder="Enter your private workspace password"
            required
            type="password"
          />
        </div>
      </div>

      {state.message ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <button
        className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
        disabled={disabled || pending}
        type="submit"
      >
        {pending ? "Checking…" : "Open trend radar"}
      </button>
    </form>
  );
}

