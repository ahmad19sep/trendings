"use client";

import {
  BellRing,
  Bookmark,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  LogOut,
  Menu,
  Radar,
  Scale,
  Settings2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

import { ThemeToggle } from "./theme-toggle";

const navigation = [
  { href: "/", label: "Trends", Icon: Radar },
  { href: "/compare", label: "Compare", Icon: Scale },
  { href: "/upcoming", label: "Upcoming", Icon: CalendarDays },
  { href: "/watch", label: "Watch", Icon: BellRing },
  { href: "/bookmarks", label: "Bookmarks", Icon: Bookmark },
  { href: "/digest", label: "Digest", Icon: FileText },
  { href: "/settings", label: "Settings", Icon: Settings2 },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function greetingForKarachi(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Karachi",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

function subscribeToClock(onStoreChange: () => void) {
  const interval = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(interval);
}

function useKarachiGreeting() {
  return useSyncExternalStore(subscribeToClock, greetingForKarachi, () => "Welcome");
}

export function AppShell({
  children,
  displayName = "Ahmad",
}: {
  children: React.ReactNode;
  displayName?: string;
}) {
  const pathname = usePathname();
  const greeting = useKarachiGreeting();
  const [moreOpen, setMoreOpen] = useState(false);
  const mobilePrimary = navigation.slice(0, 4);
  const mobileSecondary = navigation.slice(4);
  const secondaryActive = mobileSecondary.some(({ href }) =>
    isActive(pathname, href),
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[246px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen border-r border-white/8 bg-[var(--sidebar)] px-4 py-5 text-[var(--sidebar-ink)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-10 place-items-center rounded-xl bg-[#49c7b5] text-[#052d2c] shadow-[0_8px_20px_rgba(73,199,181,0.2)]">
            <ChartNoAxesCombined aria-hidden="true" size={21} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-[15px] font-semibold tracking-[-0.02em]">
              Creator Trend Radar
            </span>
            <span className="block text-xs text-[var(--sidebar-muted)]">
              Evidence before ideas
            </span>
          </span>
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Primary">
          {navigation.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-[var(--sidebar-muted)] transition hover:bg-white/6 hover:text-[var(--sidebar-ink)]",
                  active &&
                    "bg-[#49c7b5]/14 text-[#7ee2d4] shadow-[inset_3px_0_0_#49c7b5]",
                )}
              >
                <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="rounded-xl border border-white/8 bg-white/4 p-3">
          <div className="flex items-center gap-2">
            <span
              aria-label="Rules-only AI mode"
              className="inline-flex rounded-md bg-[#49c7b5]/14 px-2 py-1 text-xs font-semibold text-[#7ee2d4]"
            >
              AI OFF
            </span>
            <span className="text-xs text-[var(--sidebar-muted)]">Free mode</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--sidebar-muted)]">
            Scores use transparent rules. No paid calls are active.
          </p>
        </div>
      </aside>

      <div className="min-w-0 pb-20 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-white lg:hidden">
              <ChartNoAxesCombined aria-hidden="true" size={19} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ink)]">
                {greeting}, {displayName}
              </p>
              <p className="truncate text-xs text-[var(--ink-muted)]">
                Pakistan · Asia/Karachi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--ink-muted)] sm:inline-flex">
              Free sources only
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main>{children}</main>
      </div>

      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label="Close more navigation"
            className="fixed inset-0 z-30 bg-[#071817]/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <section
            id="mobile-more-menu"
            aria-label="More navigation"
            className="fixed inset-x-3 bottom-20 z-50 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-sm font-semibold text-[var(--ink)]">More</p>
              <button
                type="button"
                aria-label="Close more navigation"
                className="grid size-9 place-items-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]"
                onClick={() => setMoreOpen(false)}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="grid gap-1">
              {mobileSecondary.map(({ href, label, Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]",
                      active && "bg-[var(--accent-soft)] text-[var(--accent)]",
                    )}
                  >
                    <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                    {label}
                  </Link>
                );
              })}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
                >
                  <LogOut aria-hidden="true" size={18} strokeWidth={1.8} />
                  Sign out {displayName}
                </button>
              </form>
            </div>
          </section>
        </>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
        aria-label="Mobile primary"
      >
        {mobilePrimary.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-[var(--ink-faint)]",
                active && "bg-[var(--accent-soft)] text-[var(--accent)]",
              )}
            >
              <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="mobile-more-menu"
          onClick={() => setMoreOpen((open) => !open)}
          className={cn(
            "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-[var(--ink-faint)]",
            (moreOpen || secondaryActive) &&
              "bg-[var(--accent-soft)] text-[var(--accent)]",
          )}
        >
          <Menu aria-hidden="true" size={19} strokeWidth={1.8} />
          More
        </button>
      </nav>
    </div>
  );
}

