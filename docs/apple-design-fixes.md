# Apple design fixes and validation

Implemented November 7, 2026. This records the implementation following the [original audit](apple-design-audit.md). Changes are local; the production site has not been deployed.

## Changes

| Audit finding | Implementation |
| --- | --- |
| C1: clipped responsive layouts | Homepage navigation occupies its own grid column and scrolls from a reachable top; phone and short-window layouts use normal flow. The calculator centers below 1400px and scrolls within the viewport. Manual grid tracks can shrink. Utility tables stay inside horizontal scroll regions. |
| C2: small standalone targets | Homepage navigation, dialog close controls, alarm presets, dashboard buttons/selectors, and manual view buttons have 44px minimum heights. Icon controls have 44px minimum widths. Lab chart points have larger invisible pointer targets, sized from the rendered SVG dimensions, with pointer and keyboard feedback. |
| C3: text contrast | Replaced pale supporting/status text with semantic colors. Supporting lab text is `#566352`; high/low status is `#8a4b20` on `#faf0e5` (6.00:1). Within-range status is `#406334` on `#edf4e9` (6.13:1). Dark appearance has separate foreground/background pairs. Utility status colors use the darker audited recommendations. |
| C4: utility chart access | All four charts have accessible names, descriptions, and expandable tables generated from their source data: 13 monthly rows, 24 hourly rows, 365 daily rows, and four water amounts. Summer has a dashed line; winter has a solid line. |
| C5: manual view selection | Curriculum/Session Log are native toggle buttons with synchronized `aria-pressed` state and content relationships. Timer/Alarm mode buttons use the same complete native-button pattern. |
| I1: calculator Enter handling | Enter retains normal activation on focused buttons. Calculator arithmetic shortcuts stay within the panel and do not override modifier shortcuts, editable fields, or controls outside it. Escape still closes and restores focus. |
| I2: system appearance | Homepage, manual, lab dashboard, utilities, and the shared training dashboard follow system light/dark appearance. Daylight continues to select the logo independently. Native inputs receive `color-scheme` support. |
| I3: hierarchy and typography | Homepage links are grouped into Dashboards, Tools, Apps & projects, and Guides. Tools appear near the top. Local links stay in the same tab; the redundant Home link is removed. Dashboard text scales from browser settings, supporting text is generally 14px, and grids reduce columns as text grows. |
| I4: manual search feedback | A status region reports the count in the current view or explains that no matches were found. Clear Search restores the input and focus. Switching views updates selected state and the result message. |

The manual respects reduced motion for both CSS scrolling and scripted view changes, and provides an opaque header for reduced transparency. Dashboard dialog backdrops also provide a reduced-transparency fallback. Increased-contrast media queries strengthen text and borders. Print palettes remain light. The dog mark, clock, and page-specific visual themes are preserved.

Shared dashboard styles also affect TitanLog. Its additional stylesheet and SVG colors were updated to use the same roles so that its cards, text, and charts remain readable in dark appearance.

## Validation

- **42 Node tests passed:** `node --test tests/*.test.cjs tests/dashboards/*.test.cjs`.
- **102 browser checks passed:** the main local harness (49), lab dashboard QA (19), and TitanLog QA (34). Checks cover alarm persistence/ringing, calculator operation/focus, manual search/view semantics/recovery, utility chart tables, filters, history dialogs, exports, source-data identity, and existing print-preview behavior.
- Tested homepage phone widths of 320px and 390px, 844×390 landscape, the previously failing 1024px calculator layout, and 1440px desktop. At 1024px the calculator's left edge is 368px, replacing the previous −56px position. In landscape, navigation begins below the mark rather than above the page origin; the calculator fits within the viewport and scrolls internally.
- Manual, lab, and utilities were checked at phone and desktop widths without page-level horizontal overflow. The four originally reviewed pages also fit at 320px with the root text size set to 200%. This simulates text enlargement; it is not a substitute for Safari's own text/zoom behavior.
- Sampled rendered text pairs in the reviewed pages pass the applicable contrast threshold in light and dark appearance. The scan excludes hidden content, disabled controls, SVG/pseudo-element text, and opacity compositing; it is not a complete automated accessibility certification. Manual step-number colors were checked separately in dark mode.
- Native browser keyboard input confirmed that Enter activates a focused calculator digit button. Desktop keyboard focus also scrolls the homepage navigation to reveal Tools.
- JavaScript syntax checks and `git diff --check` passed. No new runtime dependency was added.

Safari, actual VoiceOver speech, and OS-level reduced-transparency behavior still require device testing. The original audit screenshots remain unchanged for comparison.

## Updated screenshots

- [Homepage, desktop](apple-design-audit/after-home-desktop.jpg)
- [Lab dashboard, phone and dark appearance](apple-design-audit/after-lab-mobile-dark.jpg)
- [Utilities chart and data table, phone](apple-design-audit/after-utilities-chart-mobile.jpg)
- [PAWS manual, phone](apple-design-audit/after-manual-mobile.jpg)
