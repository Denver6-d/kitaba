# Plan: visual redesign "calm luxury" (2026-11-20)

Earlier plans (V2 phases A–G, open data A–E) are in git history. Direction: DESIGN.md (V3). Decisions: DECISIONS.md, section "Redesign".
One commit per phase. Before each commit: lint, typecheck, test, validate:content, build; code-reviewer agent; screenshots at 390 and 1440 px when chrome-devtools-mcp is available.

| Phase | Scope |
|---|---|
| A | Tokens (CSS variables + Tailwind theme, renamed: canvas, surface, raised, line, fg, gold, mint, error), contrast verified; dark only (theme setting, toggle, pre-paint code and strings removed); fonts IBM Plex Sans Arabic + Inter (Cairo, Hanken, Literata, Atkinson Mono removed; Lexend kept as the reading-friendly option); Western digits through one pure, tested formatter; opaque header and menu restyled; GitHub sign-in removed (code, tests, docs, README, privacy); shared components: pill Button (primary gold, outline, quiet, link, destructive; default is outline so gold is always a deliberate choice), Chip, Card (surface and mint "moment"), Field/TextInput; every screen keeps at most one gold button |
| B | Welcome screen, game screens (top row, progress bar, audio button, letter boxes, Check), correction, stage result |
| C | Landing page (live mini game, three steps, 8 worlds, honest banner), motion, Web Audio sounds and haptics with Settings toggles, mobile pass (360–1440, visualViewport), Lighthouse |

## Phase A tasks
1. globals.css: new tokens, shadcn aliases, `color-scheme: dark`, no `dark` custom variant, no unused `story-wide` variant; class rename across src (scripted, then reviewed).
2. settings: drop `theme` (old stored values are ignored by zod), pre-paint script, `useResolvedTheme`, header toggle, settings page control, i18n strings; layout/manifest theme colours.
3. fonts.ts + type utilities (`font-word` for English words, headings weight 300).
4. `lib/format.ts` (`createFormatters(lang)`), used by `I18nProvider`; tests for digits, percent, dates.
5. Header (opaque canvas, name, links, menu), sheet menu, bottom bar, footer, logo.
6. auth-redirect: Google only behind the flag; GitHub removed everywhere (not the GitHub URLs of open-data sources).
7. ui/button, chip, card, field; restyle switch, tabs, dialog, alert-dialog, sheet; one gold action per screen.
8. DESIGN.md V3, DECISIONS "Redesign" R1…, SPEC touch-ups, README, checklist.
