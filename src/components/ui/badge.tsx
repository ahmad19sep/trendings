import { cn } from "@/lib/cn";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "warning" | "danger" | "info";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-[var(--surface-muted)] text-[var(--ink-muted)]",
        tone === "accent" && "bg-[var(--accent-soft)] text-[var(--accent)]",
        tone === "warning" && "bg-[var(--amber-soft)] text-[var(--amber)]",
        tone === "danger" && "bg-[var(--danger-soft)] text-[var(--danger)]",
        tone === "info" && "bg-[var(--info-soft)] text-[var(--info)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

