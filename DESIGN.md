# Kitaba — Design direction

Written with the `frontend-design` skill before any UI code. This file is the source of truth for tokens; `src/styles/tokens.css` implements it.

## Subject, audience, job
- **Subject:** *kitāba* (كتابة) means "writing". The product is the bridge between a learner's Arabic hand and English on a keyboard.
- **Audience:** Arabic-speaking teens and adults at A1–B1, often on phones, often studying in short sessions after work or school.
- **Primary job of every screen:** put one clear writing task in front of the learner and stay out of the way while they type.

## Concept: "Ink on a ruled line"
The world of the subject is the school *kurrāsa* (ruled exercise notebook), the reed pen (*qalam*), mineral ink and brass inkwells. The design borrows the **baseline rule** and the **nib** from that world, not textures or ornament. The bold element is the **writing line**: every exercise sits on a single ruled baseline, and the caret is a small brass nib. Everything else is quiet.

## Color (tokens)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--paper` | `#EEF1EC` (cool mineral paper) | `#0D1C1B` (deep malachite ink) | page background |
| `--sheet` | `#F8FAF6` | `#132625` | raised surfaces |
| `--ink` | `#14302E` (malachite ink) | `#E4EBE5` | primary text |
| `--ink-soft` | `#4C625F` | `#9DB0AB` | secondary text (≥ 4.5:1 on paper) |
| `--rule` | `#CCD6CF` | `#24403D` | baseline rules, borders |
| `--brass` | `#86600F` (text-safe, 4.9:1) / fill `#C8962E` | `#D9AE52` | the one accent: caret nib, focus, highlights, PB |
| `--correct` | `#2F6B4F` | `#7CC3A0` | typed correctly |
| `--error` | `#A3313F` (carmine) | `#F08A95` | mistakes (never the only signal: underline + glyph) |
| `--hint` | `#5A5A8C` (slate-violet ink) | `#B5B5E8` | Arabic hints and explanations |

There is no gradient wash. Depth comes from a 1px rule plus a soft two-layer shadow on raised sheets in light mode, and from translucent "glass" (`backdrop-filter: blur(14px)` over `--sheet` at 72 %) only for floating chrome: the top bar and dialogs.

## Type

| Role | Face | Notes |
|---|---|---|
| Latin display | **Literata** (variable, opsz) | A book face. Used at high optical size for hero and section titles only, weight 500, tight tracking −0.01em |
| Latin UI/body | **Hanken Grotesk** | Calm humanist grotesk, 400/500/600 |
| Arabic UI/body/display | **Cairo** | The Arabic voice of the UI. Line-height 1.7 for Arabic body (Arabic needs more leading) |
| Typing surface | **Atkinson Hyperlegible Mono** | Built for character distinction (l/I/1, O/0, rn/m), which matters for learners. 1.5–2.25 rem |
| Reading-friendly option | **Lexend** | Replaces Hanken + Atkinson Mono when enabled. Arabic stays in Cairo. Described honestly as "reading-friendly", not as a medical aid |

Scale (1.25 ratio, rem): 0.8 · 1 · 1.25 · 1.563 · 1.953 · 2.441 · 3.052 · 3.815 (hero). Body line length is at most ~68ch (Latin) / ~60ch (Arabic). The user's text-size setting scales the root (90–140 %).

Rules: no all-caps labels, no tracked eyebrows, no single-word colour accents in headlines, no "→" appended to buttons.

## Spacing, radius, elevation
- Spacing scale (4-based): `1=4px 2=8 3=12 4=16 5=24 6=32 7=48 8=64 9=96`. Sections breathe at 96px desktop, 64px mobile.
- Radius encodes hierarchy, not decoration: controls 8px, sheets 16px, chips/keys 6px, the writing line has none (it is a rule).
- Elevation: `--shadow-sheet: 0 1px 0 var(--rule), 0 12px 32px -18px rgb(20 48 46 / .28)`. Dark: no shadow, a 1px `--rule` border plus a slight inner highlight.

## Layout

```
Desktop app shell (RTL)                          Typing screen (focus)
┌──────────────────────────────────────────┐     ┌──────────────────────────────┐
│ كتابة  Kitaba     تدرّب  إملاء  جمل  …  ⚙ │     │   15  30  60   كلمات | جمل   │
├──────────────────────────────────────────┤     │                              │
│  right-aligned Arabic heading            │     │  live: 42 wpm · 96% · 88%    │
│  ┌────────── sheet ─────────┐  side info │     │  ┌ dir=ltr ───────────────┐  │
│  │ content                  │            │     │  │ the quick brown fox    │  │
│  └──────────────────────────┘            │     │  │ ─────────────────────  │← rule
└──────────────────────────────────────────┘     │  └────────────────────────┘  │
                                                 └──────────────────────────────┘
```
- The UI aligns to the **start** edge (right in Arabic, left in English). English typing text is left-aligned inside its LTR island.
- The practice area is a single centred column (max 72ch). Nothing animates inside it while the timer runs.
- Hub pages (learn, stats) use an asymmetric two-column grid (content 2/3, context 1/3) instead of rows of identical cards.

## Landing page
1. **Hero:** the live typing demo *is* the hero. An Arabic prompt sits above a ruled line ("أنا أتعلم الكتابة بالإنجليزية"); the visitor types "I am learning to write in English" with the nib caret. The headline sits beside it in Cairo display: «اكتب الإنجليزية بثقة، جملة بعد جملة». A demo-WPM readout appears on completion.
2. **Scroll story (GSAP ScrollTrigger, one orchestrated sequence):** a single pinned panel where a learner's sentence "She go to school yesterday" is corrected step by step (the error classes light up as you scroll), then morphs into the keyboard heatmap, then into the spelling queue. One story told in three beats, not fade-ups on every section.
3. **Honest promise** in plain words, then a two-option footer CTA: start the diagnostic, or practise straight away.
4. Lenis smooth scroll on the landing only. With reduced motion, the story becomes three static figures.

## Motion principles
- Motion only answers the user: key press (60 ms nib nudge on the on-screen key), dialog open, results counter, PB.
- **New personal best:** the score's baseline rule draws itself in brass from start to end (600 ms), and the number counts up once. No confetti, no particles.
- Typing screens: zero layout animation while a test is running. Transforms/opacity only. The caret moves by `transform` on a GPU layer.
- `prefers-reduced-motion` (or the manual setting): Lenis and ScrollTrigger are not loaded, counters show final values, transitions ≤ 1 frame.

## Accessibility floor
Visible focus: 2px brass outline with 2px offset on every interactive element. Contrast ≥ 4.5:1 for text (checked for the ink-soft, error and hint tokens on both papers). Errors are never colour-only (underline + strike + screen-reader text). Typing surfaces are labelled, `lang="en" dir="ltr"`. Live results use polite `aria-live` at most once per second.

## Review against the brief (second pass)
- *First draft* used deep indigo + gold. That reads close to the "luxury purple/gold AI" default and is uncomfortably near the forbidden purple gradient. **Changed** to malachite ink + brass, which is tied to ink and inkwell materials and distinct from Gymbro's red/black.
- *First draft* hero was "big stat + gradient blob". **Changed** to the live typing demo on a ruled line, which is the product itself.
- *First draft* listed features as a 3×2 grid of identical icon cards (SaaS kit). **Changed** to one pinned scroll story with three beats that show the actual feedback the product gives.
- Considered a cream paper. **Rejected** (cliché #1); the paper is a cool mineral grey-green instead.
- Kept a serif display (Literata) because the palette and layout are far from the cream/terracotta cluster, and a book face suits "writing".
- Removed planned mono-font micro-labels for stats (cliché #5); stats use Hanken tabular numerals.
