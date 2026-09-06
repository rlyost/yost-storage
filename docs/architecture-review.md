# Architecture review

## Scope and conclusions

Reviewed all five HTML pages, their executable scripts, local assets, README,
and repository file inventory. This is a static website, not a distributed
application. There are no runtime packages, server handlers, database, build
configuration. Alarm regression tests now run with Node’s built-in test runner. CNAME declares `ryost.us`;
the checkout does not establish the deployed server's caching or compression.

The static architecture is appropriate. Adding a framework, service layer,
database, or bundler solely for organization would add unnecessary complexity.
The principal concern is change safety in browser state management, followed
by client-side search scaling. No measured production bottleneck or outage was
established by this source review.

## Components and complete application data flow

| Component | Inputs → processing → outputs | State and dependencies |
| --- | --- | --- |
| Static delivery | URL → HTML/CSS and local images/scripts → browser layout | Host configuration is outside the checkout |
| Daylight | System time + inferred time-zone coordinates → solar altitude → selected logo and root `data-daylight` attribute | Private cached logo selection; immediate evaluation, minute interval, visibility event |
| Clock | System time + locale → formatted hours/minutes → clock text | Private timeout rearmed at next minute boundary; visibility event resynchronizes |
| Calculator | Delegated button clicks or keyboard → arithmetic/formatting → display | Private accumulator, operation, current string and replacement flag; dialog controls focus; no persistence or expression evaluation |
| Alarm configuration | Dialog fields/presets → duration or next wall-clock occurrence → state and absolute deadline | Timer and alarm share state; user actions write `handlerpath.alarm` to localStorage |
| Alarm restoration | localStorage JSON → atomic schema validation → expired-deadline handling → fields, scheduler and display | Recent missed deadline rings; stale deadline becomes idle; saved ringing becomes idle; normalized state is saved again |
| Alarm execution | Deadline + current time → running/paused/ringing/idle transitions → badge, controls, overlay and WebAudio | One-second ticker; visibility catch-up; ringing reads the current daylight image; repeating audio stops after five minutes |
| Manual tabs | Delegated tab click → view name → curriculum/log and navigation visibility | DOM classes; sidebar and window scrolling reset |
| Manual search | Card text cached at startup + query → animation-frame scheduling → case-insensitive matching → card/session visibility and text-node highlights | Prior marks unwrapped before each search; query shorter than two characters restores cards; no network or storage |
| Guides | Static HTML → formatted reference content | Deployment guide also calls browser print; external links navigate to other sites |

There is no server-side user-data flow. Alarm data stays in the current
browser origin. The manual's session logs are document content, not a logging
API. Search works across both views while tab visibility remains independent.
Daylight and alarm communicate indirectly through the logo DOM element.

## Critical problem areas

1. **Fixed: invalid alarm persistence.** `alarm-state.js` decodes and validates record shape,
   enum values, finite nonnegative durations and valid timestamp range,
   boolean sound preference, clock syntax and state/mode consistency before
   accepting any fields. Malformed or incomplete records restore the default
   idle timer atomically. Unknown fields are ignored. Valid records retain the
   existing storage key and format; recent/stale deadline recovery is retained.
2. **Fixed: transition effect ownership.** `commit` now owns scheduler cleanup,
   overlay cleanup, persistence, scheduling and rendering for all transitions.
   Presets replace a running, paused or ringing timer with the selected idle
   duration: deadline cleared, ticker and beeper stopped, overlay hidden.
   This completes the existing preset intent without leaving orphan effects.
   Pure transitions now live in `alarm-state.js`; input parsing, UI events,
   storage, scheduling, audio and rendering remain in the browser controller.
3. **Fixed: missing alarm regression coverage.** `tests/alarm.test.cjs` runs
   the production script against controlled time, storage, scheduling and DOM
   boundaries. It exercises UI events and checks persisted state, display
   effects and active intervals. Audio resume failures are safely handled.

## Duplicate logic and maintainability

- **Fixed: duplicated clock formatting.** `time.js` exposes the frozen
  `HandlerPathTime` utility, loaded before the clock and alarm. Both use its
  formatter, which resolves the system locale/time zone on each call to retain
  existing behavior when system settings change.
- Alarm actions now use a common transition commit for save/render and effect
  lifecycle management; input-specific duration calculations remain local.
- Visibility listeners serve different schedules and effects. Combining them
  into a global scheduler is not justified at the current scale.
- **Fixed: manual state ownership.** An isolated controller owns its listeners,
  frame handle and card metadata (element, session and normalized text). No
  search properties are attached to DOM elements and no controller variables
  leak globally. A common helper updates card/session visibility; a view map
  updates matching content/navigation together. The index is built once for
  static content; future dynamic content must rebuild metadata before search.
- Page CSS and content remain colocated. The pages have distinct visual
  designs; similar selectors alone are not evidence of reusable components.
  Extract a shared stylesheet only for rules with demonstrably shared intent.

## Performance and scalability risks

- **Mitigated: manual search blocks input.** Cleanup and highlighting run in
  cancellable animation-frame batches (at most 12 cards, yielding after a
  6 ms budget check). New input cancels the queued batch; the newest query
  starts with cleanup. Identical completed queries do no work. Each card owns
  its highlight references, avoiding a document-wide mark query, and affected
  parents normalize once per cleanup instead of once per match. Matching and
  DOM work still scale with content, and a single large card can exceed the
  budget because yielding occurs between cards. Results arrive progressively;
  chunking trades completion latency for responsiveness. A worker/index is
  not justified by the current 66-card manual.
- **Fixed: embedded hero payload.** The manual logo is a byte-identical
  4,831-byte PNG in `assets/images/manual-logo-b2e93d1fd778.png`. This removes
  6,466 bytes of base64 URL text from HTML and allows independent caching.
  Its content hash supports future cache-safe replacements. The manual already
  required a companion script; distribute the image with it as well.
- **Fixed: unused logo preload.** `daylight-selection.js` runs in the head,
  computes the same solar selection, and adds only the selected responsive
  image preload. `daylight.js` applies it at the original DOM position and
  retains minute/visibility updates. The no-JavaScript image is unchanged.
  Selection now adds a small script dependency before image discovery; savings
  are in transferred image bytes, not a guaranteed LCP improvement.
- **Fixed: redundant alarm rendering.** State transitions render controls;
  periodic/visibility updates refresh only status text and an open dialog's
  readout. Unchanged text is not assigned again. Opening the dialog explicitly
  refreshes it. Deadline checking continues while hidden, preserving alarms.
- **Retained by user choice: independent tabs.** Each tab keeps its own live
  alarm. Multiple tabs may ring separately and writes to the existing shared
  storage key remain last-writer-wins. Cross-tab ownership/synchronization was
  explicitly declined, so this is documented behavior, not an outstanding fix.
- **Platform limit: closed/suspended browsers.** Absolute deadlines and
  visibility recovery remain in place and tested. A closed browser cannot run
  these scripts; dependable background delivery would require another service
  and a notification permission flow. No background-delivery guarantee is made.
- **Verified hosting mitigation.** A read-only production header check on
  2026-09-06 UTC returned GitHub.com/Fastly delivery, `Cache-Control: max-age=600`,
  an ETag and `Vary: Accept-Encoding`. Requesting gzip/br returned gzip HTML
  (11,338 bytes for the currently deployed 45,184-byte landing page).
  Compression and edge delivery already exist. No hosting migration, DNS
  change or live deployment was made. Longer asset cache lifetimes require
  hosting configuration outside this checkout and versioned asset URLs.

### Local measurements

A Chrome comparison cloned each of the 66 cards nine additional times into a
same-origin iframe, then ran a `dog` query against the committed controller
and the new controller. `requestAnimationFrame` callbacks were wrapped with
`performance.now()` measurements; each run settled for 4.5 seconds.

| 660-card search | Before | After |
| --- | ---: | ---: |
| Longest JavaScript callback | 262.7 ms | 19.9 ms |
| Total measured callback work | 262.7 ms | 233.8 ms |
| Callback count | 1 | 119 |
| Produced highlights | 5,280 | 5,280 |

These are single local samples, not statistical benchmarks or INP measurements.
They exclude layout/paint cost and demonstrate reduced uninterrupted work, not
constant-time search. Actual queries on the manual preserved every card's text
through `dog`, `training`, and clear, ending with zero search marks.

On a local HTTP desktop night-theme load, image requests fell from 68,402 bytes
(two logos) to 23,472 bytes (selected logo), saving 44,930 bytes. Final before/after
trace samples showed LCP 1,764/1,879 ms and CLS 0.00/0.00 without throttling. This
small sample does not demonstrate an LCP improvement; the image-byte saving is
verified, and slow-network image discovery remains a deployment check.
A real-browser alarm test observed zero mutations inside the closed dialog
while its badge counted down; reopening immediately showed the current value.

## Implemented refactor

Moved the five inline behavior blocks to named files in `assets/js`, retaining
their original script positions and classic-script semantics. This separates
feature ownership from document content and allows independent syntax checks
and script caching. No framework, package install, state-schema migration,
style change, or algorithm rewrite was introduced.

The external feature scripts and shared time utility across the two interactive pages are a
cold-load tradeoff. They remain parser-blocking to preserve execution order;
solar selection now runs in the head, while logo painting stays after its DOM. Actual latency depends on hosting and cache
behavior. Do not add `async` or `defer` without checking daylight first paint,
dialog initialization, and restored alarm behavior. HTML and scripts must be
deployed together; extracted pages now depend on their companion files.

## Refactoring sequence — completed

1. **Calculator coverage:** `tests/calculator.test.cjs` covers keyboard arithmetic,
   decimal aliases, editing, percent/sign operations, division-by-zero recovery,
   digit limits, operation chaining/replacement, editable-input exclusions,
   delegated buttons, opening/closing, and focus return. Native Enter, Tab and
   Escape were also exercised in Chrome: launcher → close button → AC button →
   launcher, with the expected open/closed state.
2. **Pure alarm transitions:** `alarm-state.js` owns defaults, decoding and
   immutable state transitions. Start/stop take explicit timestamps; the module
   has no DOM, storage, audio, scheduler or implicit clock dependency. The
   controller validates UI input, gates unavailable actions and reconciles
   effects after transitions. Preference edits preserve active effects. The
   existing storage key/schema, independent tabs and recovery behavior remain.
   `tests/alarm-state.test.cjs` tests frozen inputs and time-dependent transitions
   alongside the existing controller regression suite.
3. **Repeatable browser coverage:** serve the repository and open
   `tests/browser.html` on localhost. Its 15 checks use real pages, native
   dialogs and DOM, a muted timer, reload recovery, search replacement/clearing,
   and tab switching. It restores the prior local alarm record after running.
   Keyboard dispatch in the harness is synthetic; separate trusted-key checks
   in Chrome cover native focus navigation. All 15 harness checks passed.
4. **Larger-manual profiling:** completed in the performance pass above. The
   660-card fixture demonstrated shorter uninterrupted work with equivalent
   highlights. Cancellable batches and parent-level cleanup address the measured
   cost; a worker/index remains unnecessary for current content. No additional
   optimization was made without new evidence.
5. **Deployed cold/warm baseline:** measured `https://ryost.us/` in an isolated
   Chrome context on 2026-09-06 UTC with no CPU/network throttling. Cold means
   first navigation in that context; warm means a second navigation in the same
   context. Buffered PerformanceObservers recorded LCP and CLS, and Navigation/
   Resource Timing recorded transfers; readings settled for two seconds.

   | Measurement | Cold | Warm |
   | --- | ---: | ---: |
   | TTFB | 379.6 ms | 1.6 ms |
   | FCP / LCP | 824 / 824 ms | 96 / 96 ms |
   | Observed CLS | 0 | 0 |
   | DOMContentLoaded | 969.1 ms | 54.2 ms |
   | Document transfer | 11,638 bytes | 0 bytes |
   | Resource transfer | 73,284 bytes | 0 bytes |

   Transfer sizes include response overhead. Warm transfers were zero, with
   image body sizes still present in Resource Timing, consistent with browser
   cache reuse. Cold loaded both logos, confirming that this is the current
   deployed version, not the pending refactors. These single samples establish
   a baseline, not field percentiles or proof of a deployed improvement. No
   further preload/cache changes or deployment were made in this sequence.

## Validation and limits

Run `node --test tests/*.test.cjs` from the repository root. The suite covers
malformed records, compatible records with unknown keys, pause/resume, midnight
rollover, recent/stale recovery, presets in every state, reset while ringing,
hidden-tab catch-up, ringing timeout, unavailable storage/audio and invalid input.
The suite also checks shared formatting, script dependency order, manual state
isolation, tab navigation, search filtering and clearing. All scripts pass syntax checks. These controlled browser-boundary tests do not
verify native dialog behavior, actual audio output, or browser throttling.
The Node suite passes 20 tests; the local browser harness passes 15 checks.
Local Chrome search, logo loading, alarm interactions, trusted calculator focus
navigation and landing-page traces were exercised. A deployed cold/warm baseline
was also recorded above. Native audio output, true browser suspension, other
browser engines and production performance after deployment remain unverified.
