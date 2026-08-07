# Instasorter Visual & Technical Design System

This file serves as a persistent set of rules that the AI coding agent loads automatically on every session to maintain UI consistency, perfect spacing, typography standards, and offline-first database structures.

---

## 🎨 Visual Identity & Color Palette
Instasorter uses a custom implementation of a **Studio Gallery (Cobalt & Neutral)** palette. The UI is designed to be highly recessive, allowing the user's media/photos to take center stage. All new components, modules, and screens must strictly utilize these defined variables in `src/index.css`:

### ☀️ Light Theme (Crisp Studio)
*   **Primary Accent**: `--m3-primary` (`#0f172a` - Slate 900)
*   **Secondary / Content Accent**: `--m3-secondary` (`#4b5563` - Slate Grey)
*   **Surface / Background**: `--m3-surface` (`rgba(255, 255, 255, 0.9)` - Pure White Glass)
*   **High Contrast Elements**: `--m3-on-surface` (`#0f172a` - Slate 900)
*   **Muted Borders & Outlines**: `--m3-outline-variant` (`#e2e8f0` - Soft Outline)

### 🌙 Dark Theme (Dark Room)
*   **Primary Accent**: `--m3-primary` (`#f8fafc` - Slate 50)
*   **Surface / Background**: `--m3-surface` (`rgba(9, 9, 11, 0.8)` - Deep Zinc)
*   **High Contrast Elements**: `--m3-on-surface` (`#fafafa` - Off-White)
*   **Muted Borders & Outlines**: `--m3-outline-variant` (`#27272a` - Dark Zinc Outline)

---

## 📐 Typography Hierarchy
Instasorter uses an intentional pairing of three distinct fonts to establish visual rhythm:
1.  **Display Typography**: **Outfit** (Sans-Serif, modern, geometric)
    *   *Usage*: Page titles, card headings, main metrics, modal headers.
    *   *Tailwind Utility*: `font-display tracking-tight text-m3-on-surface`
2.  **Body Typography**: **Inter** (Neo-Grotesque, highly legible)
    *   *Usage*: Explanatory text, notes, user inputs, options.
    *   *Tailwind Utility*: `font-sans text-m3-on-surface-variant`
3.  **Monospace/Data Accents**: **JetBrains Mono** (Technical, rigid, brutalist-lite)
    *   *Usage*: Database metrics, file sizes, timestamp logs, keyboard shortcut labels.
    *   *Tailwind Utility*: `font-mono text-xs text-m3-outline`

---

## 📦 Spacing, Alignment & Negative Space
To look highly polished, professional, and visually quiet, Instasorter follows strict layout spacing rules:
*   **Fluid Bounds**: Keep layouts contained with a maximum horizontal boundary (`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`) rather than stretching endlessly.
*   **Card Styling**: Posts cards must use `--m3-surface-low` background, bordered with `border-m3-outline-variant/25`, rounded with exactly `rounded-[20px]`, and wrapped in a smooth `transition-all duration-300`.
*   **Touch Targets**: Buttons, selectable chips, and navigation links must maintain an active hit target of at least `44px` on mobile layouts, utilizing elegant active scales (`active:scale-95`).
*   **List Views**: Stretched horizontal list entries should be padded with `p-3`, matching a soft background hover highlight.

---

## 🎹 Keyboard Shortcuts Architecture
Instasorter features high-efficiency keyboard shortcuts. The implementation must follow these state constraints:
1.  **Safety Guard**: Always bypass keydown handlers when the active focused element is an input, textarea, or elements marked with `contenteditable`.
2.  **Global Navigation**:
    *   `1` ➔ Navigate to Home Dashboard
    *   `2` ➔ Navigate to Analytics
    *   `3` ➔ Navigate to Grouped / Folders View
    *   `4` ➔ Navigate to Import Data Tab
    *   `5` ➔ Navigate to Curator Profile
    *   `?` ➔ Toggle Keyboard Shortcuts Modal Guide
3.  **Active Post Focus Actions (Main Grid & List)**:
    *   `ArrowRight` / `J` ➔ Move focus highlight to next post
    *   `ArrowLeft` / `K` ➔ Move focus highlight to previous post
    *   `Enter` / `Space` ➔ Open selected post modal
    *   `F` ➔ Toggle Star / Favorite
    *   `A` ➔ Toggle Archive status
    *   `R` ➔ Toggle Read Later
    *   `C` ➔ Copy original link to clipboard
4.  **Active Post Details Modal**:
    *   `ArrowRight` ➔ Move detail view to next saved post
    *   `ArrowLeft` ➔ Move detail view to previous saved post
    *   `Escape` ➔ Close detail modal

---

## 💾 Storage & Offline-First Core Rules
Instasorter is designed to work completely offline, storing and indexing exported posts locally in the client browser:
*   **Database Engine**: Dexie.js (IndexedDB wrapper).
*   **State Alignment**: State updates must simultaneously update IndexedDB and propagate immediately through the Zustand store (`usePostStore`) for reactive reactivity in components.
*   **Data Integrity**: Never pop mock data or empty placeholders if actual local data exists. Always provide clear, friendly guiding steps when the database has zero records.

---

## 📝 Brand Vocabulary Rules
To avoid low-quality tech jargon, Instasorter uses simple, humble, and literal human-readable terms. Refer to `src/constants/vocabulary.ts` for standardized copy properties:
*   Use "**Star**" or "**Favorite**" instead of overly complex metadata jargon.
*   Use "**Collections**" or "**Folders**" instead of technical database tag terminology.
*   Use "**Background Downloader**" instead of raw engine telemetry terms.

---

## 🛠️ Integrated AI Engineering Workflow Skills (Matt Pocock / AI Hero)
This project integrates Matt Pocock's AI Hero agent skills to ensure high-rigor, disciplined engineering workflows:

1. **`/grill-with-docs` (Pre-Implementation Architecture Review)**:
   - Before implementing complex multi-module features, cross-examine proposed changes against existing system rules, types, and official documentation.
   - Challenge assumptions, check for edge cases, and verify dependency compatibility before making destructive changes.

2. **`/to-spec` & `/to-tickets` (Requirement Decomposition)**:
   - Break down ambiguous or broad user feature requests into clear functional specs and concrete, atomic implementation tasks.
   - Execute each step sequentially, verifying each unit before proceeding.

3. **`/code-review` (Rigor & Zero-Slop Validation)**:
   - Enforce strict TypeScript safety (no untyped `any` parameters), robust error handling, and clean responsive Tailwind layout styling.
   - Run type checks (`tsc --noEmit`) and test suites (`vitest`) after every major code modification.

4. **`/handoff` (Session Continuity)**:
   - Provide structured, high-context summaries at the end of each task detailing modified files, verified test results, and next actions to ensure seamless session transitions.
