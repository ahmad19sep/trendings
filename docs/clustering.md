# Rules-first topic clustering

Phase 1 uses `title-rules-v1` while embeddings are disabled. The worker keeps
the decision inspectable and stores the match method and similarity on every
`topic_items` link.

1. Normalize both titles with Unicode NFKC, lowercase them, replace punctuation
   with spaces, and collapse whitespace.
2. Remove a small, documented set of English and Roman Urdu/Hindi glue words
   when at least two meaningful tokens remain.
3. Exact normalized titles score `1.0`. Other matches require at least two
   shared meaningful tokens and use:

   `0.65 × Jaccard overlap + 0.35 × smaller-title containment`

4. A normalized title contained in the other title scores at least `0.88` when
   the shorter title is at least 12 characters.
5. The merge threshold is `0.58`. Candidates are active topics seen in the last
   72 hours, capped at 500. Ties resolve by topic UUID, making the result stable.

Topic matching runs under a PostgreSQL transaction advisory lock. Existing item
links always win, and composite conflicts are ignored, so retries do not create
parallel links. The tradeoff is deliberate: titles in different scripts will
not merge unless both records have sufficiently similar English titles. A later
embedding-assisted matcher can add candidates without silently changing this
rules score or its stored method label.
