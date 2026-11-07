# Apple design audit: ryost.us

> Implementation: [fixes and validation](apple-design-fixes.md). The findings and screenshots below record the original audit state.

## Summary

**Overall rating: Critical issues.** The homepage has a distinctive identity: a personal launchpad built around the dog mark and clock. Its main weaknesses are controls and navigation that become inaccessible at some window sizes, small touch targets, and insufficient contrast in the dashboards. These can be corrected while preserving the site's character.

Reviewed November 7, 2026, using the `apple-design` skill. This is a plain HTML/CSS/JavaScript website. Apple's accessibility, typography, color, layout, and interaction principles apply as design guidance; native tab bars, menu bars, Liquid Glass, and App Store conventions are not requirements for this website. Native points and CSS pixels are different units; the CSS target sizes recommended below are practical web adaptations.

### Scope and evidence

- Browser and source review: `index.html`, including calculator and alarm; `dashboards/index.html`; `utilities-dashboard.html`; `PAWS_Training_Manual.html`.
- Homepage checked at 1440px and 1024px desktop widths, 390×844 and 320×568 phone viewports, and 844×390 landscape. Representative pages checked at desktop and 390×844 phone sizes, including dark appearance and reduced motion emulation.
- Measurements use rendered element bounds and computed CSS. Contrast uses sRGB relative luminance, not screenshot estimates. Ratios below concern small, non-large text; the target is 4.5:1.
- Reviewed local workspace files in Chromium. This does not verify production deployment, Safari rendering, actual VoiceOver output, 200% text enlargement, or every linked page. External applications and TitanLog were not independently audited. Shared dashboard CSS findings may also affect TitanLog.
- Temporary browser probes were removed. No website source was changed. Evidence screenshots: [calculator at 1024px](apple-design-audit/calculator-1024.jpg), [lab dashboard on phone](apple-design-audit/lab-mobile.jpg), [utilities on phone](apple-design-audit/utilities-mobile.jpg), [manual on phone](apple-design-audit/manual-mobile.jpg).

## Critical

### C1 — Responsive layout hides navigation, calculator controls, and reading content

**What:**

- At 1024×768, the calculator starts at **x = −56px**, with a width of 288px. Its first column is partly outside the viewport. `index.html:76` positions it to the left of the centered logo, but the centered-overlay fallback only applies below 720px (`index.html:689`).
- At 844×390 landscape, the homepage navigation is **678px tall**, spanning **y = −152px to 526px**. Home, Dashboard, and other links sit above the viewport. The landscape rule shrinks the logo but leaves the vertically centered navigation rail unchanged. See `index.html:187` and `index.html:640`.
- At a 390px phone viewport, the manual's main column becomes **546px wide**. Content is cut off to the right. A temporary browser probe using `minmax(0, 1fr)` and `min-width: 0` reduced it to 390px and eliminated page overflow. The grid's automatic minimum size lets table content widen its main track. See `PAWS_Training_Manual.html:69`, `:205`, and `:215`.
- The utilities page reaches **562px of content width** in the same 390px viewport. Tables overflow their cards, and two-column sections use a **460px minimum track width**. See `utilities-dashboard.html:18` and `:24`.

**Why:** `layout.md › Adaptability`: “Design a layout that adapts gracefully and consistently.” [Apple Layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout).

**Fix:**

- Center the calculator when the viewport cannot accommodate logo plus panel, approximately below 1200px. Bound its height with `max-height: calc(100svh - 2rem)` and allow scrolling for short windows.
- Put navigation in normal layout flow, or give it a bounded scroll region with a reachable top. Switch to the compact layout based on available height as well as width.
- Use `grid-template-columns: 230px minmax(0, 1fr)` for the manual and `minmax(0, 1fr)` for its compact layout; set the main grid item to `min-width: 0`.
- Use `repeat(auto-fit, minmax(min(100%, 460px), 1fr))` for utilities sections. Put wide tables in bounded horizontal scroll containers, or present bill rows as stacked records on phones. Preserve page-level reflow rather than hiding overflow.

### C2 — Important controls have very small hit regions

**What:** On the homepage at 390px, all 19 navigation links/actions have **15px-high** hit regions. “Calc” is **27.9×15px**. Calculator close is **19×21.6px**; alarm close is **24.4×28px**. In the lab dashboard, period controls are about **28×21.5px**, marker-name buttons are **13px high**, and individual chart points measure **7–9px** across.

**Why:** `accessibility.md › Mobility`: “Offer sufficiently sized controls.” Apple recommends 44×44pt default mobile controls, with 28×28pt minimum controls. These are HIG benchmarks, not a claim that all small inline web links fail WCAG. The homepage navigation and standalone dashboard controls are the priority. [Apple Accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility).

**Fix:** Give standalone controls at least `min-height: 44px`, icon controls `min-width: 44px`, and appropriate padding. Expand marker buttons across their cells. Add larger invisible hit regions around chart points, or allow selection across the plot area. Keep the visible marks small if that better serves the chart.

**Source:** `index.html:111`, `:198`, `:313`; `dashboards/styles.css:1`; `dashboards/app.js:138`.

### C3 — Dashboard text fails contrast checks

**What:** These values were measured from the final computed styles, including the dashboard's later CSS overrides:

| Text | Foreground / background | Ratio | Recommended foreground / resulting ratio |
| --- | --- | --- | --- |
| Lab introduction, 12px | `#7b877f` / `#f6f8f5` | **3.50:1** | `#566352` / **5.95:1** |
| Lab chart unit, 9–10px | `#8d988c` / `#ffffff` | **3.00:1** | `#566352` / **6.36:1** |
| Lab high/low status, 9px | `#ae7447` / `#faf0e5` | **3.46:1** | `#8a4b20` / **6.00:1** |
| Lab within-range status, 9px | `#5d7f4f` / `#edf4e9` | **4.06:1** | `#406334` / **6.13:1** |
| Lab missing/unknown status, 9px | `#8c9783` / `#f2f4ee` | **2.76:1** | `#57634d` / **5.75:1** |
| Utilities green status, 12px | `#2e8b57` / `#e3f4ea` | **3.72:1** | `#236b43` / **5.65:1** |
| Utilities red status, 12px | `#c8423b` / `#fbe4e2` | **4.02:1** | `#a3312c` / **5.70:1** |
| Utilities blue status, 12px | `#2f6fde` / `#e5edfb` | **4.01:1** | `#2456ac` / **5.94:1** |

**Why:** `accessibility.md › Vision`: “Strive to meet color contrast minimum standards.” These small labels need 4.5:1. Neither page provides an increased-contrast override that resolves these pairs. [Apple Accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility).

**Fix:** Adopt the suggested darker role colors, then verify every status and appearance. The table lists examples, not an exhaustive inventory of every failing label. Keep explicit High/Low/Within labels; they already help avoid conveying status by color alone.

**Source:** `dashboards/styles.css:1` and `:6`; `utilities-dashboard.html:9` and `:29`.

### C4 — Utilities charts lack a sufficient accessible equivalent

**What:** Utilities chart roots have no accessible name or description. Some bars contain individual `<title>` tooltips, but line series do not provide an equivalent structured account of the data. There is no corresponding full table for the monthly, hourly, or daily series. Winter and summer lines also share the same line style and depend on color for identification.

**Why:** `charts.md › Best practices`: “Make every chart in your app accessible.” The same page's **Color** section calls for alternatives to color-dependent identification. [Apple Charts guidance](https://developer.apple.com/design/human-interface-guidelines/charts).

**Fix:** Give each chart a title and concise summary using `<figure>/<figcaption>` and appropriately associated SVG labels. Provide a “View data table” disclosure for its values. Distinguish winter and summer with solid/dashed lines or direct series labels. The lab dashboard's named chart, focusable labeled points, and full-history table provide a useful starting pattern.

**Source:** `utilities-dashboard.html:171` and the chart construction functions that follow it.

### C5 — The manual exposes no selected state for its two views

**What:** “Curriculum” and “Session Log” are ordinary buttons whose selected state is represented only by `.active` styling. Neither has `aria-selected` or `aria-pressed`, and the controller changes only classes and content visibility. The accessibility tree cannot identify the active view from the controls.

**Why:** `accessibility.md › Vision`: “Describe your app’s interface and content for VoiceOver.” This finding concerns the DOM and accessibility semantics; actual VoiceOver speech was not tested. [Apple Accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility).

**Fix:** Either implement a complete tab pattern with a labeled tablist, `aria-selected`, panel relationships, and arrow-key navigation, or keep native buttons and synchronize `aria-pressed` and `aria-controls`. Maintain visible keyboard focus.

**Source:** `PAWS_Training_Manual.html:254`; `assets/js/manual.js:12`.

## Improvements

### I1 — High: calculator shortcuts override normal button activation

**What:** With the “7” button focused, Enter leaves the display at 0; Space enters 7. The document-level handler treats every Enter as equals and prevents normal activation, including on the close button.

**Why:** `accessibility.md › Speech` calls for keyboard-only operation. The controls remain usable with Space, but Enter behaves contrary to native HTML button behavior. [Apple Accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility).

**Fix:** Let Enter activate the focused button. Restrict calculator shortcuts to its interaction scope, and run Enter-as-equals only when a button is not focused. Keep Escape dismissal and focus restoration.

**Source:** `assets/js/calculator.js:114`.

### I2 — High: appearance ignores the person's system preference

**What:** With dark appearance emulated, the homepage remains `#f3f3f3` during daylight; lab, utilities, and manual content also remain light. The homepage's sunrise/sunset mechanism controls both imagery and interface appearance, independently of `prefers-color-scheme`.

**Why:** `dark-mode.md › Best practices` recommends supporting both appearances; **Dark Mode colors** recommends adaptive colors. On this website, this is a comfort and consistency recommendation, not an App Store requirement. [Apple Dark Mode guidance](https://developer.apple.com/design/human-interface-guidelines/dark-mode).

**Fix:** Separate logo selection from appearance. Keep the sunrise/sunset mark as a signature feature; use CSS semantic color variables and `prefers-color-scheme` for page, dialog, control, and text colors. Set the appropriate `color-scheme` so native inputs also adapt.

**Source:** `assets/js/daylight.js:14`; `index.html:576`; the color tokens in each reviewed page.

### I3 — High: navigation and dashboard typography need a clearer hierarchy

**What:** The homepage gives 19 destinations/actions equal prominence in a rail only **71.1px wide** at the tested desktop size. Long names wrap to three or four lines. The lab dashboard uses 8–12px text for many labels, with 8px highlight statuses on phones.

**Why:** `layout.md › Visual hierarchy` recommends grouping related functions and ordering by importance. `typography.md › Ensuring legibility` recommends easily readable sizes. [Apple Layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout), [Apple Typography guidance](https://developer.apple.com/design/human-interface-guidelines/typography).

**Fix:** Group links into Dashboards, Apps, and Guides, with a separate Tools group for alarm/calculator. Give the desktop navigation enough width for readable labels. A practical web starting point is 16px body text and 13–14px supporting text, preserving larger values for results and headings. Those CSS sizes are design recommendations, not literal Apple point specifications.

### I4 — Medium: manual search has no empty-state feedback

**What:** Searching for an unmatched string hides all cards and produces no result message or live announcement. The tested query left zero visible cards and no status region.

**Why:** `writing.md › Best practices`: “Provide clear next steps on any blank screens.” [Apple Writing guidance](https://developer.apple.com/design/human-interface-guidelines/writing).

**Fix:** Show “No matches for …” with a Clear Search control, and announce a settled result count through `role="status"`. Clarify whether results belong to the active view or both views.

**Source:** `assets/js/manual.js:28` and `:97`.

## Craft notes

**Design judgment:** The dog mark and clock are the homepage's memorable element. Preserve them. Spend the next iteration on the surrounding navigation's readability and organization. The manual's warm palette, sequential steps, and cue chips suit the training material; the overflow bug currently undermines that otherwise coherent reading experience.

One accessory to remove is the homepage's Home link: it opens another copy of the same homepage in a new tab. Also consider keeping local navigation in the same tab so browser Back remains useful. These are web interaction judgments, not Apple-specific mandates.

## What works

- System font stacks provide a familiar, readable base without a font download.
- The dog mark gives the homepage personality without requiring additional decoration.
- The calculator names its operator buttons, labels its close control, announces its output, supports Escape, and restores focus through its close function.
- The alarm configuration uses a native modal dialog with a close control and scrollable height. It fits the tested 320px viewport without internal horizontal overflow. Its ringing animation has a reduced-motion fallback.
- The lab dashboard has a skip link, visible focus styling, status words, named chart points, and a full-history table. Its wide results table stays within a scroll container on the tested phone viewport.
- The manual's main prose colors have strong contrast, and its numbered training steps encode an actual sequence.

## Recommended sequence and acceptance checks

1. Fix clipped layouts, text contrast, and standalone hit regions.
2. Complete chart alternatives and selected-state semantics; correct calculator Enter handling.
3. Add adaptive appearance, improve typography/navigation grouping, and add search feedback.
4. Recheck 320px, 390px, 844×390, 1024px, and wide desktop layouts; then test 200% text/zoom, Safari, VoiceOver, keyboard-only use, dark mode, increased contrast, and reduced motion. The manual also has unconditional smooth scrolling and header blur; verify reduced-motion and reduced-transparency behavior during that pass.

Reference headings cited here were read from the skill's bundled Apple HIG pages. Official Apple URLs are linked for follow-up. Accessibility severity reflects the skill's review rubric, rather than a formal WCAG certification.
