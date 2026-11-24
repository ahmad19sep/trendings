import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-grid flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm">
        <Icon aria-hidden="true" size={23} strokeWidth={1.8} />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--ink-muted)]">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

