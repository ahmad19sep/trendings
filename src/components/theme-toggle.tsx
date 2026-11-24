"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const choices = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Laptop },
] as const;

const subscribeToMount = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div
      className="flex rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-1"
      aria-label="Color theme"
    >
      {choices.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} theme`}
          aria-pressed={mounted && theme === value}
          disabled={!mounted}
          className="grid size-7 place-items-center rounded-md text-[var(--ink-muted)] transition hover:text-[var(--ink)] aria-pressed:bg-[var(--surface)] aria-pressed:text-[var(--accent)] aria-pressed:shadow-sm"
          onClick={() => setTheme(value)}
        >
          <Icon aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}

