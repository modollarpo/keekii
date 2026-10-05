# Design-System Phase 0 Audit Findings
*Posted before any code change, as required by the super-prompt (section 2, "Process").*

*Audit date: early October 2026 (confirmed via git; commit f592851 aligned with origin/master).*
*Prompt read in full: C:\Users\USER\Downloads\keekii-design-system-remaining-super-prompt.md (147 lines).*
*All earlier UI-consistency and playback work (autoplay, sleep timer, personalized channels, "See all" pattern, icon consolidation) confirmed shipped and working.*

---
## 0. Already shipped — do not redo
- Autoplay (`autoplay-button.tsx`), sleep timer (`sleep-timer-button.tsx`).
- Personalized channel content type with popular-tracks fallback for new users and correct queue threading.
- Personalized channels prepended to country hub pages.
- `channel-heading.tsx`: title left, "See all" text link + chevron right, no border — the canonical pattern, applied.
- Icon system consolidated on `lucide-react` (sidebar, queue toggle now one state-driven chevron instead of three mismatched icons).
- Carousel arrow placement/sizing fixed across several components.
- Type-scale tokens exist (`keekii-display` class in use).

---
## 1. Spacing scale (confirmed outstanding)
- **11 distinct `gap-*` values** in use across the player (`gap-0.5` through `gap-8`), with near-duplicates `gap-2`/`gap-2.5`/`gap-3`/`gap-3.5` all in parallel use.
- **No spacing tokens exist in `config/themes.php`.**
- **Action:** Define a small, explicit spacing token set (same `--be-*` convention as existing tokens in `config/themes.php`) and migrate the player's `gap-*` (and `p-*`/`m-*` where clearly ad hoc) onto it. Collapse near-duplicate values rather than preserving all eleven as "the scale."
- **File references:** `resources/client/web-player/channels/` — gap utilities appear on `ChannelContent`, `ChannelContentCarousel`, `ChannelHeading`, `PersonalizedCarousel`, `TrackGridItem`, and various container wrappers. Approx. 40 instances.

---
## 2. Content max-width (confirmed outstanding)
- **Only 2 files** in the player use a `max-w-*`/`max-w-prose` container: `media-page-header-layout.tsx` and `queue-sidenav.tsx`.
- These two files already reference container/width patterns — check these first for a reusable seed worth generalizing rather than inventing a new one from scratch.
- Other pages (prose/forms/detail) run full-width with no constraint.
- **Action:** Build one shared content-container pattern generalizing from the two existing files and apply to prose/forms/detail pages. Leave content grids alone; they already respond correctly via container queries.
- **File references:** `media-page-header-layout.tsx`, `queue-sidenav.tsx` — both reference container/width patterns.

---
## 3. Ambient color in the player bar (confirmed outstanding)
- `desktop-player-controls.tsx` and `mobile-player-controls.tsx` are still flat `bg-card`, with no connection to `player-page-header-gradient.tsx`'s existing blur-based approach (which still only covers player page headers, dark mode only).
- **Extend the blur approach** (or replace with true dominant-color extraction — state reasoning either way) to:
  - Light mode, not just dark.
  - `desktop-player-controls.tsx` and `mobile-player-controls.tsx`, not just page headers.
- **Non-negotiable constraints:**
  - Never block playback or scrolling on image/color processing — compute asynchronously, fall back to the current flat `bg-card` until ready.
  - Check WCAG AA contrast for any text rendered over the derived background; scrim/darken/desaturate as needed rather than using a raw extracted color behind text.
- **File references:** `desktop-player-controls.tsx`, `mobile-player-controls.tsx`, `player-page-header-gradient.tsx` — the gradient file is the basis for workstream C; confirmed dark-mode only, blur approach unchanged since last check.

---
## 4. Accent-color usage (confirmed outstanding — catalog first)
- **5 files** in the player reference the brand accent now (`--be-brand-ink` / hex values).
- **Action:** Catalog the 5 current accent-color usages specifically — functional or decorative — before touching any of them. Do not assume work is required here.
- **File references:** Search for `--be-brand-ink` across `resources/client/` — expected 5 matches in player component files.

---
## 5. Motion/elevation (confirmed outstanding)
- **14 files** use `shadow-*` (up slightly from 10 at last check, but still a small fraction of the player's components).
- **No stated system** for hover/press feedback.
- **No `prefers-reduced-motion`** support mentioned.
- **Action:** Add small, consistent hover/press states to cards, the play control, and the "See all" link's hover state; keyboard-focus row highlighting; confirm skeleton loaders still match what they replace. Respect `prefers-reduced-motion`; no layout shift.
- **File references:** Search for `shadow-*` across `resources/client/web-player/` — 14 files.

---
## Post findings before writing code
- The prompt explicitly requires **posting findings before any code change** (section 2, "Process").
- **Do not start workstreams A–E until the audit report is published** and the two decision points are answered:
  - **Workstream C:** Extend existing blur approach or implement true dominant-color extraction? (WCAG AA contrast scrim/darken/desaturate required either way.)
  - **"See all" vs "View all":** Any stray instances outside the canonical fix that were already addressed need verification; none reported in the earlier fix.

**Report structure (for publication to the team):**
- Gap-value count before/after (target: ≤4 tokens)
- Content-width pattern: 2 files with containers vs full-width elsewhere
- Ambient color: light/dark extension + WCAG AA contrast scrim values
- Accent-color: 5 instances classified as functional vs decorative
- Motion: 14 shadow files + proposed hover/press skeleton + reduced-motion check
- TS error count and `vite build` result (baseline: zero new errors)
- Any `common/` file touches (minimal; only if absolutely required)

---
## Process
- **Phase 0 — Audit** (section 2). Post findings before any code change.
- **Phase 1 — A and B** (spacing, max-width). Mechanical, low-risk, touches the most files.
- **Phase 2 — C** (ambient player-bar color), built and checked in isolation before wiring into both control bars.
- **Phase 3 — D (if needed) and E** (accent cleanup only if warranted, motion pass).
- **Phase 4 — Report.** What changed and real before/after numbers (gap-value count, accent-usage classification, shadow/motion usage); every `common/` file touched; TS error count and build result; contrast-check results for workstream C; anything phase 0 found that changed the plan (e.g. D turning out to be unnecessary).

**Stop and ask rather than guess on:** whether to extend the existing blur approach or build true color extraction for C, and "See all" vs "View all" wording consistency if any stray instances turn up that weren't part of the earlier fix.