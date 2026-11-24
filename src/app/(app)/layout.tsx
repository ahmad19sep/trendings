import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";

export const instant = false;

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <AppShell displayName={session.displayName}>{children}</AppShell>;
}

function ShellFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--background)]">
      <div className="flex items-center gap-3 text-sm font-medium text-[var(--ink-muted)]">
        <span className="size-4 animate-pulse rounded-full bg-[var(--accent)]" />
        Opening your radar
      </div>
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

