# agent.md — React/TypeScript + shadcn/ui Refactor Rules

## 0) Prime Directive

- Preserve behavior. Do not change UX or data flow unless explicitly requested.
- Prefer small, safe, incremental refactors over rewrites.
- Do not introduce new dependencies unless explicitly requested.

## 1) Stack & Standards

- React 18 + TypeScript.
- Functional components only.
- Prefer named exports.
- Keep formatting consistent with the repo (Prettier/ESLint).

## 2) Project Structure (follow existing; only improve when clearly needed)

Typical intent (do not force-migrate if different):

- src/components/ → shared UI components (app-level)
- src/components/ui/ → shadcn/ui components only (generated + minimally edited)
- src/features/ → feature modules (UI + hooks + utils scoped to a feature)
- src/hooks/ → shared hooks
- src/lib/ → shared utilities (pure functions)
- src/services/ → API clients / data layer

Rules:

- Do not move files unless it clearly reduces coupling or fixes inconsistency.
- Keep feature-specific logic inside the feature folder.
- Shared logic belongs in hooks/lib/services.

## 3) shadcn/ui Rules (important)

- Use shadcn/ui components from `components/ui/*` (or the repo’s configured path).
- Do not re-implement shadcn components in place—compose them.
- If a shadcn component must be modified, keep changes minimal and consistent with upstream style.
- Prefer `cn()` utility for className composition (usually from `lib/utils`).
- Keep Tailwind class usage consistent; avoid inline style objects unless truly dynamic.

## 4) React Patterns

State:

- Local UI state: `useState`.
- Derived values: derive inline or via `useMemo` (avoid syncing state to props).
- Complex state/side effects: extract to custom hooks.

Effects:

- `useEffect` only for true side effects (subscriptions, imperative APIs, timers).
- Avoid effect chains; prefer explicit events/handlers.

Rendering:

- Keep JSX readable; extract subcomponents if component exceeds ~150–200 lines.
- Avoid deeply nested conditionals; prefer early returns or small render helpers.

## 5) TypeScript Rules

- Props must be explicitly typed (interface/type).
- Avoid `any`. If unavoidable, isolate it and document why.
- Prefer discriminated unions for variant props where relevant.
- Keep types close to usage (component-local types in same file; shared types in `types.ts`).

## 6) Data + Services

- UI components should not call fetch directly.
- Data fetching lives in `services/` (clients) + hooks (usage).
- Handle errors explicitly (no silent catches).
- Keep API shapes typed.

## 7) Refactor Guidelines (what to do)

- Improve naming, cohesion, and separation of concerns.
- Extract repeated logic into hooks/utilities.
- Remove dead code and unused exports.
- Reduce prop drilling when there’s a clear local boundary (but don’t introduce new global state).

## 8) Performance & Correctness

- Only add memoization (`useMemo`, `useCallback`, `React.memo`) when there’s a clear re-render cost.
- Prefer stable component boundaries over excessive memoization.
- Avoid creating new objects/functions in hot render paths when it causes real churn.

## 9) Testing (if tests exist)

- Do not break existing tests.
- Update tests only when behavior intentionally changes.
- Prefer behavior-based tests.

## 10) Output Requirements for Agent Changes

- When editing files: output full updated file contents.
- Keep changes focused; explain only when non-obvious.
- If uncertain, choose the least risky change.
