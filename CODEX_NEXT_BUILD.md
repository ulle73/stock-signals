# CODEX_NEXT_BUILD.md

## Purpose

This file defines the next focused Codex build scope for `stock-signals`.

Do **not** try to build the full `SIGNAL_SYSTEM_IMPLEMENTATION_PLAN.md` roadmap in one session.

The roadmap is direction. This file is the immediate build order and guardrail.

---

## Current target

Move the repo from “many indicators and summaries” toward a real signal system.

The first goal is to create the foundation that lets future signal models generate clean, deduplicated, explainable alerts.

---

## Build order

Build in this order:

```text
1. signal_events queue
2. RS-ranking
3. standardised market regime output
4. earnings-filter
5. data quality gates
6. Regime-Gated Breakout signal
7. Telegram/Discord routing
8. Sector Rotation Alert
9. Volatility Dip Buyer
10. research/deprioritisation of PLCE, Markov and TF Sync
11. daily summary
```

Important user preference:

```text
RS-ranking should be priority 2.
Earnings-filter should be priority 4.
```

---

## First Codex implementation scope

For the first implementation pass, focus only on:

```text
1. signal_events queue
2. RS-ranking foundation
3. standardised market regime output
```

Do **not** implement earnings, Telegram/Discord, breakout systems, dip-buy systems, or sector rotation alerts in the first pass unless explicitly asked.

---

## Part 1 — signal_events queue

### Goal

Create a generic signal event layer that all future systems can write to before anything is sent to Telegram or Discord.

### Why

The repo already has many indicators and summary layers. It needs a single queue that can track:

- what signal triggered
- when it triggered
- whether it has been sent
- whether it is pending, sent, expired or cancelled
- which channel it should eventually route to
- the original payload/reasons behind the signal

### Expected outcome

After this part, future systems should be able to create standardised `signal_events` rows without sending messages directly.

### Acceptance criteria

- migration exists for `signal_events`
- repository functions exist for upsert/read/update operations
- duplicate prevention exists
- status handling exists
- tests exist
- no Telegram/Discord sending is implemented yet

---

## Part 2 — RS-ranking foundation

### Goal

Create a daily relative-strength ranking layer.

Minimum useful fields:

```text
rs_21d_vs_spy
rs_63d_vs_spy
rs_126d_vs_spy
rs_rank_21d
rs_rank_63d
rs_rank_126d
rs_percentile_21d
rs_percentile_63d
rs_percentile_126d
```

### Why

Relative strength is the most important missing quality filter for future stock signals.

Breakout, momentum and sector systems should be able to prefer stocks that are outperforming SPY and avoid weak stocks even if a technical trigger appears.

### Expected outcome

After this part, future long signals can require strong RS, and future short/risk signals can identify weak RS.

### Acceptance criteria

- RS table or equivalent persisted daily layer exists
- RS is calculated from existing stock daily prices and benchmark data
- SPY benchmark handling is clear
- ranks/percentiles are calculated by date across the active universe
- tests exist for calculation and ranking behavior
- no strategy is built yet using RS

---

## Part 3 — standardised market regime output

### Goal

Make the existing market regime easier for all future systems to consume.

Standard output should be:

```text
risk_on
neutral
risk_off
```

### Why

The repo already has market regime data, but future systems need one simple shared gate.

All future stock-specific systems should be able to ask:

```text
Is the market risk_on, neutral or risk_off?
```

### Expected outcome

After this part, future systems can consistently gate signals based on market regime.

### Acceptance criteria

- market regime output is standardised
- existing market signal logic is preserved unless a small mapping change is needed
- tests confirm score/status mapping
- no existing pipelines are broken

---

## Explicitly do not build yet

Do not build these in the first pass:

- earnings-data fetcher
- earnings signal blocker
- Telegram sender
- Discord sender
- Regime-Gated Breakout signal
- Sector Rotation Alert
- Volatility Dip Buyer
- GEX/DEX
- Alpaca execution changes
- dashboard redesign
- new broad backtest system

---

## Guardrails

- Keep data-fetching pipeline stable unless a new data source is explicitly required.
- Prefer additive migrations and modules.
- Do not rewrite existing indicator logic unless necessary.
- Do not send alerts directly from indicator modules.
- Do not mix routing, signal creation and indicator calculation in the same module.
- Add tests for each new layer.
- Update README only if scripts or user-facing commands change.

---

## Next steps after first pass

When the first pass is complete, the next likely build is:

```text
4. earnings-filter
5. data quality gates
6. Regime-Gated Breakout signal
```

But do not start those until the foundational queue + RS + regime work is stable.
