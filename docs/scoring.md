# Contentability Score

The Contentability Score answers one narrow question: **can a solo creator make something useful about this topic soon?** It is not a popularity score and never decides what Ahmad should make.

## Default components

| Component | Weight | Calculation |
| --- | ---: | --- |
| Early momentum | 20 | `clamp(25 × log2((mentions_6h + 1) / (baseline_6h + 1)), 0, 100)`, plus 10 for a ≥50% three-hour acceleration; multiply by 0.5 when the topic is older than 48 hours and already has at least 40 outlets. |
| Cross-source reach | 15 | `100 × (1 − e^(−distinct_outlets / 8)) + 8 × platform_signals`, capped at 100. Syndicated copies count once and manual items count zero upstream. |
| Source-native rank | 10 | Per list: `100 × (1 − (position − 1) / list_length)`; use the maximum and add 5 when the topic appears in at least two markets. No signal is an explicit, labeled 0. |
| Freshness | 10 | `100 × 0.5^(age_hours / 12)` from `first_seen_at`. |
| Pakistan-vs-world gap | 10 | `100 × world_presence × (1 − min(1, PK_or_Urdu_or_Hindi_outlets / 5))`; it is 0 until at least five worldwide outlets cover the topic. Pakistan-origin stories exclude this component and redistribute its weight. |
| Explainability | 10 | Rules: 20 per non-syndicated source with a substantive summary, capped at 100. With AI, average the rules score with the AI 0–3 rating mapped to 0/33/67/100. With AI off, rules supply the full value. |
| Shelf life | 10 | Flash/short/lasting maps to 20/60/90, plus 10 when linked to an upcoming event. AI-off mode uses a visible rule/category assessment. |
| Urdu/Hindi audience relevance | 15 | Rules add 40 for a PK/IN story location, 30 for Urdu/Hindi coverage, and 30 for a high-affinity category. With AI, average the rules score with the AI 0–3 rating. With AI off, rules supply the full value. |

The default weights total 100. Settings may replace them only with another non-negative set totaling 100.

## Missing and disabled components

Missing is `null`, never an invented zero. Momentum is `null` while there are fewer than 24 hours of snapshots and no GDELT baseline; the result is labeled **Collecting history** and **provisional**. A Pakistan-origin story similarly makes the gap component not applicable.

When a component is missing, not applicable, or switched off, its weight is redistributed across the remaining components in proportion to their configured weights:

```text
effective_weight_i = configured_weight_i / sum(configured_weights_of_included_components) × 100
contribution_i = component_value_i × effective_weight_i / 100
```

Every stored result contains the component value, raw inputs, configured and effective weights, contribution, method, explanation, score version, and any exclusion reason. Contributions are calculated without intermediate rounding; the UI rounds only the final display score.

## Worked example

For normalized component values `65, 83, 90, 59, 68, 74, 60, 32` in the table order above:

```text
13.00 + 12.45 + 9.00 + 5.90 + 6.80 + 7.40 + 6.00 + 4.80
= 65.35, displayed as 65
```

## Risk flags

Risk flags are a separate evidence layer. They do not enter this score. Each flag records a type, severity, reason, evidence IDs, and whether it was rule-based or an AI suggestion. Any future risk penalty must remain a distinct, opt-in feature and is off by default.

