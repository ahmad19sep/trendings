"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../ui/button";

export function TopicNotes({ topicId }: { topicId: string }) {
  const key = `ctr:topic-note:${topicId}`;
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setNotes(window.localStorage.getItem(key) ?? ""),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [key]);

  return (
    <div>
      <label htmlFor="topic-notes" className="text-sm font-semibold text-[var(--ink)]">Your notes</label>
      <textarea
        id="topic-notes"
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
          setSaved(false);
        }}
        rows={5}
        className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
        placeholder="Capture context or follow-up questions. Notes stay separate from provider data."
      />
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            window.localStorage.setItem(key, notes);
            setSaved(true);
          }}
        >
          <Save aria-hidden="true" size={16} />
          Save notes
        </Button>
        {saved ? <span className="text-sm text-[var(--ink-muted)]">Saved in this browser</span> : null}
      </div>
    </div>
  );
}

