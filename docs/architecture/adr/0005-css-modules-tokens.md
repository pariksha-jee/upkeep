# ADR 0005 — CSS Modules + design tokens (no inline styles)

**Status:** Accepted · **Date:** 2026-11-12

## Context

Hard requirement: no inline CSS; styling must live in CSS files and stay
extensible; professional standard palette.

## Decision

- One global `tokens.css` defines every visual primitive as CSS custom
  properties (semantic names: `--color-surface`, `--status-up`, `--space-4`…).
  Dark theme = same token names remapped under `[data-theme="dark"]`.
- Every component owns a colocated `*.module.css` using **only** semantic
  tokens — no raw hex/px outside tokens.css.
- Charts are the single documented exception: data-driven geometry passes
  through per-element CSS custom properties / SVG attributes; all strokes,
  fills and sizes still come from tokens/classes.
- Mobile mirrors the same values as TS constants (`src/theme.ts`).

## Consequences

- ✅ Re-theming = editing one file; tokens are discoverable and greppable.
- ✅ No runtime CSS-in-JS cost; styles are statically extractable.
- ✅ Enforcement is reviewable: `grep "style={" apps/web/src` outside charts
  returns nothing (one intentional case in ResponseChart for height).
