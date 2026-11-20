# Design direction

> **V3, "calm luxury" (owner-approved, 2026-11-20).** This replaces the V1/V2 direction ("ink on a ruled line", light and dark themes, malachite and brass). It takes the restraint of linear.app as a reference for discipline, not for looks: our identity is a deep green-black canvas, one warm gold, light mint "moment" cards and big, light type. The V2 text is in git history. Decisions: DECISIONS.md, section "Redesign".
>
> Rollout: all three phases are done: A (tokens, fonts, dark only, digits, header and menu, shared components), B (welcome, game, correction and result screens; DECISIONS R12–R18) and C (landing, motion, sound and haptics, mobile pass, Lighthouse; R19–R24).

`src/app/globals.css` implements the tokens. Components use the Tailwind names (`bg-canvas`, `text-fg-2`, `bg-gold`…) and never a raw hex value. The few colours that must exist outside CSS (browser chrome, manifest, icon) live in `src/config/theme.ts`, and a test keeps them equal to the CSS.

## Subject, audience, job
- **Subject:** English spelling for Arabic speakers, one word at a time.
- **Audience:** Arabic-speaking teens and adults (A1–C1), often on phones, in short sessions.
- **Primary job of every screen:** put one word in front of the learner, take the answer, explain the rule.

## Principles
1. **Calm.** One dark canvas, hairline borders, generous space, one section per screen height on the landing page. Nothing moves while the learner types.
2. **One gold.** Gold is the only accent and it means "this is the thing": the one primary button, progress, stars, the active level chip, target letters.
3. **Moments are mint.** The light mint card is reserved for the moments that matter: the rule behind a mistake, a result, the honest promise.
4. **Words are the hero.** The word being spelled is the largest thing on a game screen, in Inter.

## Colour (dark only)

| Token (CSS / Tailwind) | Value | Role | Contrast |
|---|---|---|---|
| `--canvas` / `canvas` | `#0B110F` | page background, header, bottom bar | |
| `--surface` / `surface` | `#121A17` | cards, the menu drawer, inputs | |
| `--raised` / `raised` | `#16201C` | nested cards, hover, the selected pill, dialogs | |
| `--line` / `line` | `rgba(232,236,233,0.08)` | hairline borders and dividers | |
| `--line-strong` / `line-strong` | `rgba(232,236,233,0.40)` | outlines of form controls and outline buttons | 3.4:1 (WCAG 1.4.11) |
| `--fg` / `fg` | `#E8ECE9` | text | 16.0 / 14.9 / 14.0 |
| `--fg-2` / `fg-2` | `#A9B4AF` | secondary text | 8.9 / 8.3 / 7.8 |
| `--fg-3` / `fg-3` | `#9AA5A0` | muted text (footer, placeholders) | 7.5 / 7.0 / 6.6 |
| `--gold` / `gold` | `#E2B657` | the only accent | 10.0 / 9.3 / 8.8 |
| `--gold-hover` | `#F0CB78` | primary button hover | |
| `--on-gold` | `#17140B` | text on gold | 9.7 (11.8 on hover) |
| `--mint` / `mint` | `#E9F1EC` | moment cards | |
| `--on-mint` | `#13201A` | text on mint | 14.6 |
| `--on-mint-2` | `#33463D` | secondary text on mint | 8.8 |
| `--mint-label` | `#6A5214` | the small label on a moment card | 6.5 |
| `--error` / `error` | `#F2A27E` | mistakes, always with a strike-through, underline or icon | 9.3 / 8.6 / 8.2 |

Contrast is shown on canvas / surface / raised. Every pair is ≥ 4.5:1 and is checked by `tests/lib/theme.test.ts`.

No gradients, no glow washes, no glassmorphism, no emoji. The header, the bottom bar and the menu are opaque. Depth comes from the step between canvas, surface and raised, plus hairlines; there are no shadows.

## Type

| Role | Face | Notes |
|---|---|---|
| Arabic UI | **IBM Plex Sans Arabic** 300, 400, 500, 600 | line-height 1.75 for Arabic body |
| English UI, English words, Latin text | **Inter** (variable) | the UI face in English, and every `lang="en"` island |
| The word being spelled, typed answers | **Inter** with `cv05` and `cv08` (`.font-word`) | a tailed `l` and a serifed `I`, so l / I / 1 are told apart |
| Reading-friendly option | **Lexend** | replaces Inter for Latin text when the setting is on; Arabic stays in Plex |

- **Headings are large and light:** h1 and h2 are weight 300. Page titles use `clamp(2rem, 6vw, 3rem)`, the landing headline `clamp(2.25rem, 7vw, 4rem)`. Long words wrap (`overflow-wrap: anywhere` on headings) instead of overflowing.
- Body text is 17 px on phones and 18 px from 768 px up; the text-size setting (90–140%) scales it.
- **Western digits (0–9) everywhere**, including the Arabic UI (`ar-u-nu-latn`), and the Latin `%` sign. `src/lib/format.ts` is the one formatter.
- No all-caps labels, no tracked eyebrows, no "→" on buttons.

## Shape and space
- Buttons and chips are pills (`999px`). Cards are 24 px (`rounded-card`), moment cards 28 px (`rounded-card-lg`), inputs 14 px (`rounded-field`).
- Touch targets are at least 44 × 44 px: buttons are 44, 48 or 56 px tall.
- 4-based spacing. Sections breathe at 96–128 px on desktop and 64 px on phones.

## Shared components (`src/components/ui`)
- **Button:** `primary` (gold, at most one per screen, never the default), `outline` (the default), `quiet`, `link`, `destructive`; sizes `sm` 44, `default` 48, `lg` 56, `icon` 44.
- **Chip / LevelChip:** small pills; the active level chip is gold.
- **Card:** `surface`, `raised`, `moment` (mint) with `MomentLabel`.
- **Field / TextInput:** visible label, hint and error tied with `aria-describedby`; an error is announced, underlined and dashes the border.
- **Segmented:** native radios as pills; `activeTone="gold"` for level choice.
- **Switch, Tabs, Dialog, AlertDialog, Sheet:** restyled Radix primitives; overlays are a plain 60% black, no blur.

## Layout and navigation
- The UI aligns to the start edge. English answer areas are LTR islands (`dir="ltr" lang="en"`).
- **Header (opaque canvas):** the name, the five core areas from 768 px up, and the menu button. On phones: only the name and the menu button. Phase C adds one gold "Start free" on the landing page, shown only once the hero's gold button has scrolled away, so a screen never shows two.
- **Menu:** a drawer from the end edge with the core areas (phones), Leaderboard, Account, Settings, Privacy, Open data credits and the language switch. It traps focus and closes on Esc and on an outside click. There is no theme switch.
- **Phones:** a bottom tab bar with the five areas, hidden on game and writing screens and while the keyboard is open.
- **Footer:** the name and one short line.

## Screens (phases B and C)
1. **First-visit welcome:** small label, a large light heading ("let us find your spelling level first"), one short line, the level chips A1–C1 as a preview, one big gold pill "Test my level" with a small "3 minutes, recommended" tag, an outline pill "I choose my level", a quiet link "Skip for now (A2)". The gold button breathes gently.
2. **Game screens:** top row with a close button, a thin gold progress bar and the level chip; title and "world / stage / word N of 10"; a big round gold audio button with slow expanding rings; "slower" and "in a sentence" pills; letter boxes that light up one by one as the learner types; the hint line; a labelled input; a gold "Check". Letter boxes appear for typed letters only, so they never reveal the word's length (DECISIONS R12).
3. **Correction:** the learner's answer with the wrong letters struck through or underlined in the error colour; the correct spelling with the key letters in gold and an audio button; a mint rule card (rule title, a short Arabic explanation with a memory trick, an example sentence); "added to your review"; a gold "Next".
4. **Stage result:** a mint card with 1–3 stars, the stage name, a heading, how to earn the next star, three stat tiles (accuracy, XP, streak); the words going to review as pills; gold "Next stage" and outline "Replay".
5. **Landing:** header; hero with a large light heading about mastering English spelling word by word, a short line, gold "Test my level" and outline "Try a round", beside a real live mini game card on wide screens (a word typed letter by letter, the audio button, a mint rule card); "three steps in every round"; the path of 8 worlds; the mint honest banner (we teach spelling, we do not promise fluency or check grammar); a minimal footer. Word and sentence counts are never shown. The live card opens with a demo mistake typing itself and its correction, then becomes a real round ("Try it yourself"). The header's gold "Start free" appears only once the hero's gold button has scrolled away (DECISIONS R19–R20).

## Motion
- Headings and sections fade up softly on entry (0.6–0.8 s, staggered).
- The audio button has slow expanding rings; the welcome screen's primary button breathes.
- Letters light up as they are typed; nothing else moves while the learner types.
- After Check: a short shake on a wrong answer, the mint rule card slides up, stars pop in one after another with a spring, numbers count up.
- No animation blocks input; everything stays at 60 fps. Under `prefers-reduced-motion` or the manual setting every motion is an instant state change.

## Sound and haptics
Short synthesised Web Audio sounds (correct, wrong, star) and `navigator.vibrate` where supported. Both are off by default, with toggles in Settings. No audio files. `lib/feedback.ts` decides, `lib/sound.ts` and `lib/haptics.ts` play; the vibration toggle is disabled where the browser cannot vibrate (DECISIONS R22).

## Accessibility floor
- Visible focus: a 2 px gold outline, 3 px offset.
- Text contrast ≥ 4.5:1 (table above, tested); control outlines ≥ 3:1.
- Errors are never colour-only.
- Answer inputs are labelled, `lang="en" dir="ltr"`, with `autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"`, and stay above the phone keyboard.
- Verdicts are announced through a polite live region.
- No horizontal scroll at 360, 390, 768, 1280 and 1440 px.

## Review history
- V1: indigo and gold became malachite and brass; the stat hero became the product.
- V2: the live spelling game hero, an opaque header, bigger body text.
- V3: dark only, one gold accent, mint moment cards, IBM Plex Sans Arabic and Inter, light headings, pill controls, Western digits.
