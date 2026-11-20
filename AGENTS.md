# Repository Guidelines

## Project Structure & Module Organization

This is a static French and England income calculator with no package manager or build pipeline. Source files live at the repository root:

- `index.html` / `england.html`: country interfaces; Chart.js 4.4.0 loads from a CDN. Shared CSS lives in `styles.css`.
- `calculator.js`: pure salary, tax, family-benefit, and Pinel calculations exposed through `CALC`.
- `mortgage.js`: pure loan calculations exposed through `MORT`.
- `app.js`: Chart.js setup, DOM rendering, controls, and mouse/touch interactions.
- `england-calculator.js` / `england-app.js`: independent England calculations (`ENGLAND_CALC`) and UI.
- `tests/`: Node calculation and UI regression tests. `docs/`: tax methodology and sources.

Keep calculation logic independent of the DOM and Chart.js. Preserve script order: calculator, mortgage, then UI. Monthly gross income is the canonical value; annual chart values convert by a factor of 12.

## Build, Test, and Development Commands

- `node --check app.js`: check UI JavaScript syntax. Repeat for `calculator.js` and `mortgage.js` when changed.
- `git diff --check`: detect whitespace errors before committing.
- `node --test tests/*.test.cjs`: run calculation and UI regression tests.

No compilation or dependency installation is required. Internet access is needed to load Chart.js from the CDN.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, single-quoted JavaScript strings, and `const` unless reassignment requires `let`. Follow existing camelCase function and variable names, uppercase calculation constants, and the `CALC`/`MORT` namespaces. Keep interface text and euro formatting in French. Preserve existing DOM IDs and section organization unless the change requires otherwise. No formatter or linter is configured.

## Testing Guidelines

Tests use Node's built-in test runner; no coverage threshold is configured. Run regression tests, syntax checks, and manually exercise affected behavior in a browser. For interaction changes, check mouse and touch controls, precision increments, freeze/unfreeze, and monthly/annual synchronization. For calculation changes, check boundaries, household configurations, and enabled/disabled benefits. Use descriptive behavior names in `tests/*.test.cjs`.

## Commit & Pull Request Guidelines

History mostly uses short `feat:` messages, such as `feat: allow sliding on graph on mobile`. Use concise imperative subjects; `fix:` suits corrections. Keep commits focused.

PR descriptions should explain the problem, resulting behavior, validation performed, and known limitations.
Prefer small PRs that are easy to review, with one targeted change per PR. A single atomic feature may require many lines; cohesion matters more than line count. Split unrelated functionality and refactors into separate PRs. Use stacked PRs for dependent changes, targeting the preceding branch and describing only the incremental diff.

- Before editing files or committing, check the current branch. If on `main`, create and switch to a feature branch first.
- Never modify files or create commits while on `main`, and never push directly to `main`. Use pull requests.
- Amending commits on feature branches is allowed.

Link relevant issues when available and include screenshots for visible interface or interaction changes. For tax or benefit updates, document the source and effective year.
