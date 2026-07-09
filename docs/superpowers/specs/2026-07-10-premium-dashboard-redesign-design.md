# Premium dashboard redesign

## Goal

Redesign the existing MarketSignals dashboard as a dark, premium market-intelligence interface. In the first ten seconds, a user should be able to identify the current action, signal strength, key changes, sector leadership, and available data-health status.

The visual reference establishes the intended density and hierarchy: a compact top navigation, a green-accented decision hero, tight metric cards, and a readable terminal-style sector table. The top navigation supersedes the earlier sidebar preference.

## Scope and constraints

This is a frontend presentation refactor only.

- Preserve all existing backend, repositories, API contracts, queries, migrations, data fetches, calculations, sort order, thresholds, and signal logic.
- Reuse only data already passed to the dashboard or exposed by existing frontend presentation paths.
- Do not invent financial values, historical points, signals, or sector data. Missing values must be rendered as existing missing-data copy or omitted according to the surrounding UI pattern.
- Do not add package dependencies. Use a local, presentational inline-SVG line-icon component where icons are needed.
- Do not introduce client-side data fetching or financial calculations in a new presentational component. Existing data-loading components remain unchanged.

## Information architecture

1. **Top navigation** — MarketSignals brand, compact desktop navigation, selected Overview state, and the existing update status.
2. **Decision hero** — the current model recommendation remains the primary message. The label, strength/score, risk position, exposure, date, and supporting copy all come from the current dashboard data and interpretation already used by the page.
3. **Change cards** — the existing indicator/heatmap items become dense visual cards. Their labels, values, details, and tones remain unchanged; each card receives an icon and a purely decorative background treatment. A chart is rendered only if the relevant existing presentation data contains chart points.
4. **Primary sector matrix** — immediately after the change cards, render every sector already available in the frontend sector view model, in its existing order. This is a full comparison matrix, never a top/bottom subset. It is the first detailed section after the hero and change summary.
5. **Secondary panels** — existing breadth, momentum, signal, and data-health information is visually grouped into quieter supporting panels without changing the data source or meaning.
6. **Status footer** — a thin status row makes existing freshness and coverage values easy to scan. It contains no synthetic latency, schedule, or coverage values.

## Visual system

- Background: near-black charcoal with a restrained blue-green cast.
- Surfaces: subtly elevated dark panels with a 16–20px radius, low-contrast borders, and soft shadows.
- Accent: vivid green for active/positive status; red for negative; amber for caution; muted gray for neutral or missing data.
- Typography: high-contrast numerical hierarchy, compact uppercase labels, and quiet secondary metadata.
- Active green elements may have a modest glow. Gradients may be used as low-opacity decorative texture only and must never reduce text contrast.
- Icons: consistent thin line icons, decorative unless the control already has behavior.
- Tables: dense but legible rows, sticky/clear headers where appropriate, visual separators, strength bars, and signed color values.
- Sector matrix: visually group the existing rate-of-change information (such as supplied 1D, 1W, 1M, ROC, acceleration, or trend fields) beside the sector label. Single numeric values may use bars, meters, chips, or progress indicators. Signed values retain their supplied sign and use positive/negative tone. Existing acceleration fields may use segmented blocks, and existing series data may use sparklines. No absent series is simulated.

## Component boundaries

- `app/page.js` remains responsible for composing the page from the current snapshot and current view models. Its data reads and transformations are not altered.
- Small new components, if needed, are presentation-only and accept fields through props. Likely examples are `DashboardIcon`, `ProgressBar`, `StatusChip`, and a chart renderer that receives an already-existing series.
- `app/layout.js`, `app/globals.css`, and `app/restyle.css` provide the app shell and visual tokens. Styles are responsive: compact navigation and stacked panels below desktop widths, while preserving readable tables through horizontal containment when needed.
- Existing data-loading components and API routes are not modified. Any existing sector or market component is only repositioned or restyled.
- The sector matrix must render every sector supplied by its existing frontend view model. It can conditionally omit a column or visual treatment when that field is absent, but it cannot calculate or replace ROC, acceleration, trend, ranking, or strength values.

## Error and missing-data behavior

- The existing loading, failure, and no-data copy remains intact.
- A presentation helper must render neutral/missing output for `null`, `undefined`, empty, or non-finite display values rather than deriving a replacement value.
- Color and bar width may only visualize the supplied display value; no new market classification, threshold, or financial calculation is introduced.
- A sector matrix may show an existing missing state for an unavailable field, but never substitutes a calculated value or synthetic series.

## Verification

- Inspect the git diff to ensure only presentation files and this documentation are changed.
- Run relevant unit tests for dashboard view models to confirm presentation work did not alter them.
- Run a production build.
- Inspect the desktop layout and a smaller viewport to verify visual hierarchy, readable overflow behavior, and that the current recommendation is dominant.

## Out of scope

- Database and migration changes.
- Query, repository, API, or fetch-pipeline changes.
- Signal rules, thresholds, ranking, sort order, or financial calculations.
- New Telegram, backtest, or data-health functionality.
- Mock data or replacement data values.
