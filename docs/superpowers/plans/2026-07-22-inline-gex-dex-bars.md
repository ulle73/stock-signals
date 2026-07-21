# Inline GEX/DEX Chart Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw live price-scale-linked GEX bars on the left and DEX bars on the right of the main chart pane, capped at 30% width per side.

**Architecture:** A focused Lightweight Charts series primitive attaches to the existing candlestick series and converts each strike with `priceToCoordinate`. `ChartWorkspace` loads the existing strike endpoint once and supplies the same payload to the primitive and the existing options panel.

**Tech Stack:** Next.js 16, React 19, JavaScript ES modules, Lightweight Charts 5.2, Node test runner.

## Global Constraints

- Work only on `codex/chart-inline-gex-dex-bars`.
- Do not merge to `main`.
- GEX must render on the left; DEX on the right.
- Each side must be capped at 30% of the current main-pane width.
- The overlays must follow the candlestick price scale during vertical zoom, scale dragging and resize.
- The overlay must not affect chart autoscaling.
- Preserve the existing options panel and existing Gamma Flip/default level-line behavior.
- No database, provider, API schema or migration changes.

---

### Task 1: Pure inline-bar geometry

**Files:**
- Create: `lib/chart/gex-dex-inline-bars.js`
- Test: `tests/gex-dex-inline-bars.test.js`

**Interfaces:**
- Produces: `buildInlineExposureRows(strikes)` returning finite `{ strike, netGex, netDex }` rows.
- Produces: `buildInlineExposureGeometry({ rows, paneWidth, paneHeight, priceToCoordinate, maxWidthRatio })` returning visible rows with independent GEX/DEX bar widths and left/right coordinates.

- [ ] Write tests proving invalid rows are removed, visible strikes are filtered by Y coordinate, GEX and DEX scale independently, and each width is `<= paneWidth * 0.30`.
- [ ] Run `node --test tests/gex-dex-inline-bars.test.js` and confirm it fails because the module does not exist.
- [ ] Implement the minimal pure helpers.
- [ ] Run the focused test and confirm it passes.
- [ ] Commit with `feat(chart): add inline exposure geometry`.

### Task 2: Lightweight Charts series primitive

**Files:**
- Modify: `lib/chart/gex-dex-inline-bars.js`
- Test: `tests/gex-dex-inline-bars.test.js`

**Interfaces:**
- Produces: `GexDexInlineBarsPrimitive` with `attached`, `detached`, `updateAllViews`, `paneViews`, and `setRows`.
- Consumes the attached candlestick series `priceToCoordinate` and `requestUpdate` callbacks.

- [ ] Add a structural test for the primitive lifecycle, stable pane-view array and no autoscale contribution.
- [ ] Run the focused test and observe the expected failure.
- [ ] Implement a pane renderer using `target.useMediaCoordinateSpace`, z-order `bottom`, 30% edge zones, green positive bars, red negative bars, compact values and strike labels.
- [ ] Run the focused test and confirm it passes.
- [ ] Commit with `feat(chart): render inline GEX DEX primitive`.

### Task 3: Share strike payload in ChartWorkspace

**Files:**
- Modify: `app/chart/chart-workspace.js`
- Modify: `app/chart/options-ladder.js`
- Test: `tests/options-ladder.test.js`
- Test: `tests/chart-inline-gex-dex-integration.test.js`

**Interfaces:**
- `ChartWorkspace` owns `{ strikes, spotPrice, sourceTimestamp, dataQuality }` and strike load status.
- `OptionsLadder` accepts optional `strikePayload` and `strikeStatus`; it falls back to its current internal request when those props are omitted.
- `FinancialChart` receives `gexDexStrikes`.

- [ ] Add regression tests proving the workspace supplies one payload to both chart and panel and the panel supports preloaded data.
- [ ] Run focused tests and confirm failure.
- [ ] Add a fail-open strike fetch effect in `ChartWorkspace` keyed by ticker.
- [ ] Pass the payload/status to `FinancialChart` and `OptionsLadder`.
- [ ] Preserve the panel's existing standalone fallback behavior.
- [ ] Run focused tests and confirm pass.
- [ ] Commit with `refactor(chart): share GEX DEX strike payload`.

### Task 4: Attach the primitive to the price chart

**Files:**
- Modify: `app/chart/financial-chart.js`
- Test: `tests/chart-inline-gex-dex-integration.test.js`

**Interfaces:**
- `FinancialChart({ gexDexStrikes = [] })` creates `new GexDexInlineBarsPrimitive({ maxWidthRatio: 0.30 })` and attaches it to `priceSeries`.

- [ ] Add integration-source assertions for the import, constructor ratio, `attachPrimitive`, row update, and cleanup detachment.
- [ ] Run the focused test and confirm failure.
- [ ] Attach the primitive immediately after candlestick data is set.
- [ ] Ensure the primitive receives new rows when the chart is recreated for ticker/period changes.
- [ ] Detach the primitive before chart removal.
- [ ] Run focused tests and confirm pass.
- [ ] Commit with `feat(chart): embed GEX DEX bars in price pane`.

### Task 5: Full verification and pushed preview branch

**Files:**
- Modify only if verification identifies an implementation defect.

- [ ] Run `node --test tests/gex-dex-inline-bars.test.js tests/chart-inline-gex-dex-integration.test.js tests/options-ladder.test.js`.
- [ ] Run `node --test tests/*.test.js`.
- [ ] Run `npm run build`.
- [ ] Confirm the Vercel deployment for the final branch commit reaches `READY`.
- [ ] Report the branch name and exact local commands: `git fetch origin`, `git switch codex/chart-inline-gex-dex-bars`, `git pull origin codex/chart-inline-gex-dex-bars`, `rm -rf .next`, `npm run dev`.
- [ ] Do not merge the branch.