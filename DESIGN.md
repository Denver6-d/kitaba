# Design direction

> V2 (spelling pivot, 2026-11-17): the product is now English spelling only. The name lives in `src/config/brand.ts`. The palette, type families and accessibility floor carry over from V1. The layout, navigation, landing and game-feel sections were rewritten for the pivot.

Written with the `frontend-design` skill. This file is the source of truth for tokens; `src/app/globals.css` implements it.

## Subject, audience, job
- **Subject:** English spelling for Arabic speakers. The school *kurrāsa* (ruled exercise notebook) still fits: a word is written letter by letter on a baseline.
- **Audience:** Arabic-speaking teens and adults (A1–C1), often on phones, often in short sessions after work or school.
- **Primary job of every screen:** put one word in front of the learner, take the answer, and explain the rule in one line.

## Concept: "Ink on a ruled line"
The design borrows the **baseline rule** and the **nib** from the notebook, not textures or ornament. Every answer sits on a ruled baseline. Brass is the single accent: stars, focus and the combo chip. Everything else is quiet. It should feel luxurious and adult, never childish.

## Color (tokens)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--paper` | `#EEF1EC` | `#0D1C1B` | page background |
| `--sheet` | `#F8FAF6` | `#132625` | raised surfaces, header, menu |
| `--ink` | `#14302E` | `#E4EBE5` | primary text |
| `--ink-soft` | `#566B67` (V2: 5.0:1 on paper, 5.4:1 on sheet) | `#93A7A2` (V2: 6.9:1 on paper, 6.2:1 on sheet) | secondary text: lighter than V1, still ≥ 4.5:1 |
| `--rule` | `#CCD6CF` | `#24403D` | baseline rules, borders |
| `--brass` | `#86600F` (text-safe) / fill `#C8962E` | `#D9AE52` | the one accent: stars, focus, combo, highlights |
| `--correct` | `#2F6B4F` | `#7CC3A0` | correct letters |
| `--error` | `#A3313F` | `#F08A95` | mistakes (never the only signal: strike or underline plus text) |
| `--hint` | `#5A5A8C` | `#B5B5E8` | Arabic hints and rule explanations |

There is no gradient wash. Depth comes from a 1px rule plus a soft two-layer shadow on raised sheets in light mode. **V2:** the header and the menu are opaque `--sheet`, because the translucent "glass" let page text show through the header.

## Type

| Role | Face | Notes |
|---|---|---|
| Latin display | **Literata** | Hero and section titles only, weight 500 |
| Latin UI/body | **Hanken Grotesk** | 400/500/600 |
| Arabic UI/body/display | **Cairo** | Line-height 1.7 for Arabic body |
| Answers and words | **Atkinson Hyperlegible Mono** | Distinguishes l/I/1 and rn/m, which matters in spelling. 1.5–2.25 rem |
| Reading-friendly option | **Lexend** | Replaces Hanken and Atkinson Mono when enabled. Arabic stays in Cairo |

- **V2 size:** body text is 17 px on phones and 18 px from 768 px up (root 106.25% → 112.5%). The user's text-size setting (90–140%) still scales the root.
- Scale (1.25 ratio, rem): 0.8 · 1 · 1.25 · 1.563 · 1.953 · 2.441 · 3.052 · 3.815. Body line length ≤ ~68ch (Latin) / ~60ch (Arabic).
- Rules: no all-caps labels, no tracked eyebrows, no "→" appended to buttons.

## Spacing, radius, elevation
- 4-based spacing scale. Sections breathe at 96px on desktop and 64px on mobile.
- Radius encodes hierarchy: controls 10px, sheets 16px, chips 999px, the answer line none (it is a rule).
- Touch targets are at least 44 × 44 px everywhere (buttons, menu items, stage nodes, choice options).

## Layout and navigation

```
Phone (390 px, RTL)                      Desktop (1280 px+, RTL)
┌───────────────────────────┐            ┌────────────────────────────────────────────────┐
│ Kitaba                  ☰ │ opaque     │ Kitaba   الرئيسية  العب  المراجعة  تقدّمي    ☰ │
├───────────────────────────┤            ├────────────────────────────────────────────────┤
│  ●●●○○ 4/10     ×3        │            │  stage info      │  game sheet                  │
│  ┌ dir=ltr ─────────────┐ │            │  (rule, combo)   │  ┌ dir=ltr ───────────────┐ │
│  │  a c c _ m m _ d a t e│ │            │                  │  │ word / sentence        │ │
│  │ ───────────────────── │ │            │                  │  │ ────────────────────── │ │
│  └───────────────────────┘ │            │                  │  └────────────────────────┘ │
│ [ answer               ]  │            └────────────────────────────────────────────────┘
│ [        Check         ]  │ ← sticky bottom action, lifted above the keyboard
├───────────────────────────┤
│ Home  Play  Review  Me    │ ← bottom tab bar (phones only, hidden while typing)
└───────────────────────────┘
```

- The UI aligns to the **start** edge. English answer areas are LTR islands (`dir="ltr" lang="en"`).
- **Header:** the name, the four core destinations (Home, Play, Review, My progress) on ≥ 768 px, and a three-line menu button on every size. The menu is a drawer dialog holding Leaderboard, Account, Settings, Privacy, and the language and theme switches. It traps focus, closes on Esc and on an outside click, and opens from the end edge (left in RTL, right in LTR).
- **Phones:** the core destinations move to a bottom tab bar within thumb reach. It hides while the virtual keyboard is open.
- **Footer:** only the name and one short line.
- **Game screens:** one centred sheet (max 42rem). On phones the primary action is full width at the bottom, kept above the virtual keyboard (`interactive-widget=resizes-content` plus `scrollIntoView` on focus). Short landscape screens put the prompt and the input side by side.
- **Campaign map:** each world is a section with its name, rule focus and level. Its 10 stages are a grid of nodes (5 columns on phones, 10 on wide screens), and each node shows 0–3 brass stars. The boss node is ringed in brass. Locked nodes are dimmed and labelled "locked" for screen readers.
- Hub pages use a 2/3 + 1/3 grid on wide screens and one column on phones.

## Landing page
1. **Hero, wide:** the copy (headline, one-line promise, "Play now") sits beside a **large live game**: a real "Pick the right spelling" round on a ruled sheet, playable right there. On ≥ 1024 px the visual takes 7/12 of the width. Below that it stacks under the copy.
2. **Seven modes:** a grid of compact cards, each showing its mechanic in miniature (letters, blanks, options), not identical icon cards.
3. **The rule behind the mistake:** one worked example (recieve → receive).
4. **Honest promise** and the privacy line, then the final CTA.
5. Motion: the hero visual fades in once. Everything is static under reduced motion. Lenis was removed, because it fought native scrolling on phones.

## Game feel (luxurious, adult, not childish)
- **Correct:** the answer turns `--correct` and a brass underline sweeps across it (150 ms). The combo chip ticks up.
- **Wrong:** a short horizontal shake of the input, then the correct word with the differing letters marked and a one-line rule in `--hint`.
- **Stage cleared:** stars draw in one by one (brass, 300 ms each) and the XP counter counts up once. No confetti, no mascots.
- Sounds are optional and off by default: two soft Web Audio tones.
- Under `prefers-reduced-motion` or the manual setting, all of this becomes an instant state change.

## Accessibility floor
- Visible focus: a 2px brass outline with a 2px offset on every interactive element.
- Contrast ≥ 4.5:1 for text (ink-soft, error and hint, on both papers).
- Errors are never colour-only.
- Answer inputs are labelled, `lang="en" dir="ltr"`, with `autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"`.
- Verdicts are announced through a polite live region.

## Review history
- V1: indigo + gold was changed to malachite + brass. The "big stat + gradient blob" hero was replaced by the product itself. A 3×2 icon-card grid was replaced by a scroll story.
- V2: the typing demo hero became a live spelling game. The scroll story was removed with the features it described. The translucent header became opaque. Body text was enlarged, secondary text lightened (contrast checked), and the landing page widened.
