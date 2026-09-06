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

1. **Fixed: invalid alarm persistence.** `decode` validates record shape,
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
   Input parsing and UI event handlers remain in the browser controller.
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

- Manual search scans all cached card text and traverses matching text nodes
  on every processed query. Unwrapping every highlight and normalizing its
  parent creates further DOM work, especially for common queries. Animation
  frames coalesce input but do not move work off the main thread. Measure
  long-query sessions on an expanded manual before choosing chunked
  highlighting or a search index; an index alone will not reduce DOM costs.
- The manual embeds a base64 hero image, tying its transfer and caching to
  the HTML. Externalizing it would permit independent caching but remove
  the manual's existing single-file portability, so it was left intact.
- The landing page preloads both possible logos. That avoids late discovery
  after daylight selection but may transfer an unused image. Compare cold
  cache traces before changing this intentional tradeoff.
- Alarm rendering updates all controls each second while visible, including
  when its dialog is closed. Separate countdown updates from configuration
  rendering if profiling shows meaningful cost; currently the DOM is small.
- Each tab runs and persists its own alarm state. There is no storage-event
  synchronization or shared ownership, so multiple tabs can ring separately.
  Single-owner coordination would change behavior and needs a product choice.
- Browser timers are not a reliable delivery mechanism while a browser is
  closed or suspended. Absolute deadlines support recovery, not background
  execution guarantees. Reliable out-of-browser notifications require a
  separate capability, beyond a behavior-preserving refactor.
- Serving more readers primarily stresses static delivery, not application
  compute. Hosting headers and deployed traces must be inspected separately;
  no claims about live latency, compression, or cache hit rates are made here.

## Implemented refactor

Moved the five inline behavior blocks to named files in `assets/js`, retaining
their original script positions and classic-script semantics. This separates
feature ownership from document content and allows independent syntax checks
and script caching. No framework, package install, state-schema migration,
style change, or algorithm rewrite was introduced.

The external feature scripts and shared time utility across the two interactive pages are a
cold-load tradeoff. They remain parser-blocking to preserve execution order
relative to the original markup. Actual latency depends on hosting and cache
behavior. Do not add `async` or `defer` without checking daylight first paint,
dialog initialization, and restored alarm behavior. HTML and scripts must be
deployed together; extracted pages now depend on their companion files.

## Next refactoring sequence

1. Extend behavioral coverage to calculator keyboard and focus interactions.
2. If the alarm grows further, extract pure transitions from the browser
   controller; persistence decoding and effect reconciliation are now separated.
3. Add real-browser interaction coverage alongside the controlled alarm suite.
4. Profile realistic larger manual content. Optimize the
   measured search/highlight cost while preserving tab and search interaction.
5. Measure deployed cold/warm loads before changing preload or caching policy.

## Validation and limits

Run `node --test tests/*.test.cjs` from the repository root. The suite covers
malformed records, compatible records with unknown keys, pause/resume, midnight
rollover, recent/stale recovery, presets in every state, reset while ringing,
hidden-tab catch-up, ringing timeout, unavailable storage/audio and invalid input.
The suite also checks shared formatting, script dependency order, manual state
isolation, tab navigation, search filtering and clearing. All scripts pass syntax checks. These controlled browser-boundary tests do not
verify native dialog behavior, actual audio output, or browser throttling.
No real-browser interaction suite or production performance trace was run.
