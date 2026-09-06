# Yost Storage

A lightweight static website hosted at [ryost.us](https://ryost.us). It has no build
step, runtime dependencies, frameworks, or third-party scripts. Pages are plain HTML,
CSS, and JavaScript; the landing page additionally loads local responsive image assets.

## Pages

- `index.html` — **The Pack.** Landing page: a logo that swaps itself at sunrise and
  sunset, a large digital clock, a pop-up calculator, a timer/alarm, and the **RLTW!**
  signoff.
- `PAWS_Training_Manual.html` — PAWS Service Dog Training Manual. Sticky header with
  live search and tab filtering, a sidebar table of contents, and session logs.
- `zsh_terminal_colorization_guide.html` — Walkthrough for switching to Zsh and
  colorizing the macOS Terminal prompt.
- `claude-engineering-prompts.html` — Reusable prompts for Claude engineering work.
- `multi_platform_deployment_guide.html` — Deployment guidance across supported
  platforms.

## Landing page

### Daylight logo swap

The logo and page palette follow the sun rather than a fixed clock time:

| | Logo | Background |
|---|---|---|
| Day | `HandlerPath_Gators-512.webp` / `HandlerPath_Gators-1024.webp` | light (`#f3f3f3`) |
| Night | `gitlabrador-512.webp` / `gitlabrador-784.webp` | black, with a white ring around the mark |

The sun's altitude is computed in-page from the NOAA solar-position formulas using the
viewer's clock and time zone — no API call, no geolocation prompt, no network round
trip. Sunrise/sunset is taken at −0.833°, which puts the sun's upper limb on the
horizon with refraction included. It re-checks every minute and whenever the tab
regains focus.

Latitude is inferred from the IANA time zone and longitude from the standard-time UTC
offset (DST excluded, since that tracks longitude better). To pin the whole site to one
location's sun instead, set `LAT` and `LON` to fixed numbers near the top of `assets/js/daylight.js`.

### Clock

Hours and minutes only, rendered in the viewer's own locale and time zone so it matches
whatever their system clock shows. It re-arms on the exact next minute boundary rather
than on a fixed interval, so it flips at `:00` and stays in step after the machine
sleeps or the clock changes.

### Timer / alarm

Opened from **Set Alarm** in the menu. Two modes share one state machine:

- **Timer** — hours/minutes/seconds, plus 1, 5, 10, 25, 30 minute and 1 hour presets.
- **Alarm** — a wall-clock time; a time already past today rolls to tomorrow.

Controls are **Set** (arms it; reads *Resume* after a Stop), **Stop** (banks the
remaining time so Resume picks up exactly where it left off — on a wall-clock alarm
there is nothing to resume into, so Stop disarms it), **Reset** (back to the configured
duration, disarmed), and **Turn Off** (silences a ringing alarm).

When it fires, a full-screen overlay enlarges the current logo and flashes the
background white ↔ yellow. It picks up whichever logo is live, so it flashes the night
mark after dark. The flash runs at ~1.4 Hz — deliberately under the 3 Hz WCAG 2.3.1
photosensitive-seizure threshold — and `prefers-reduced-motion` gets a steady yellow
instead. Ringing self-stops after five minutes. A repeating WebAudio beep is on by
default and can be switched off in the panel.

State persists in `localStorage` under `handlerpath.alarm`. A deadline missed while the
tab was closed still rings if it came due in the last five minutes; anything staler is
dropped silently. Deadlines are stored as absolute timestamps rather than accumulated
intervals, so a throttled background tab or a sleeping laptop cannot drift the count.
The visible countdown updates once per second and skips DOM rendering while the page is
hidden.

### Calculator

Opened from **Calc**, the final item in the landing-page menu. The calculator is a
non-modal dialog kept outside the document's main layout: while closed it is not
rendered and cannot move or resize the logo, navigation, footer, or other content. It
appears to the left of the logo on desktop and as a centered overlay on narrow screens.

The calculator supports addition, subtraction, multiplication, division, percentages,
sign changes, decimals, clearing, and keyboard input. **Calc** toggles it, the close
button or Escape dismisses it, and focus returns to the menu control. Division by zero
reports an error without executing arbitrary expressions or using `eval`.

## PAWS manual search

Search is performed locally across all manual cards. Each card's normalized text is
cached once, input work is coalesced to the next animation frame, and matching text is
highlighted with DOM nodes rather than injected HTML. Clearing a query unwraps the
highlights without rebuilding card contents, preserving listeners and avoiding retained
copies of every card's markup.

## Navigation

The landing-page menu links to:

- Home
- PAWS Training Manual
- [Yost Group](https://www.yost.group/index.html)
- [Apps](https://www.yost.group/apps/apps.html)
- [TitanLog](https://www.yost.group/apps/titanlog/titanlog.html)
- [YostNotes](https://www.yost.group/apps/yostnotes_app.html)
- [The Gateway](https://www.yost.group/apps/gateway_app.html)
- [Citadel Money](https://app.citadel-map.com)
- [GitHub](https://github.com/rlyost)
- Zsh Color Guide
- Claude Engineering Prompts
- Multi-Platform Deployment Guide
- Set Alarm — opens the timer/alarm panel on the page rather than navigating
- Calc — opens the calculator beside the logo

## Responsive behaviour

All pages carry a viewport meta tag and are laid out fluidly.

- **Landing page** — below 720px the right-hand nav rail becomes a centred wrapped row
  and the footer returns to normal flow, since the rail would otherwise sit on top of
  the logo. The clock is `clamp(2.25rem, 11vw, 60pt)`, so it reaches its full 60pt on
  desktop without forcing a horizontal scrollbar on a phone. A
  `(min-width: 721px) and (max-height: 640px)` rule caps the logo for landscape phones,
  where the viewport is wide enough for the desktop layout but far too short for a
  full-size mark. The alarm card tightens below 420px.
  The calculator moves from the logo's left side to a centered overlay below 720px.
- **PAWS manual** — breakpoints at 860px (sidebar collapses, topbar wraps) and 560px.
  Tables sit in `.tablewrap` scroll containers so the wide five-column table scrolls
  instead of crushing its columns. Off-screen cards use `content-visibility: auto` to
  defer rendering work. A print stylesheet strips the chrome.
- **Zsh guide** — breakpoint at 640px. The sample prompt is unbreakable monospace, so it
  scrolls in place rather than widening the page.

## Assets

| File | Used by |
|---|---|
| `HandlerPath_Gators-512.webp`, `HandlerPath_Gators-1024.webp` | responsive daytime logo |
| `gitlabrador-512.webp`, `gitlabrador-784.webp` | responsive night logo and alarm flash |
| `favicon-64.png` | right-sized landing page favicon |
| `HandlerPath_Gators.webp`, `gitlabrador.webp`, `favicon.png` | retained source assets |
| `gitlabrador.jpg` | currently unreferenced |

The PAWS manual embeds its own hero logo as an inline base64 PNG and has no external
image dependencies.

## Performance

- Both possible above-the-fold logos are preloaded so the JavaScript daylight decision
  does not delay image discovery.
- Responsive `srcset` candidates prevent small screens from decoding oversized images.
- The production favicon is 64 × 64 and approximately 4 KB; the original source is
  retained for future asset generation.
- Image dimensions are assigned before each logo source, preventing layout shift.
- Static system font stacks avoid font downloads and layout changes.
- The PAWS manual defers off-screen card rendering and avoids whole-card HTML cloning
  during search.

A local Chrome performance trace is useful for regression testing, but its timings are
machine-dependent. Validate deployed performance separately because CDN latency, cache
headers, compression, and connection conditions are not represented by a local file
load.

## Local preview

No build step is required. Open `index.html` directly in a browser, or serve the
directory locally:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Deployment

Served as a static site; the `CNAME` file configures the custom domain as `ryost.us`.
For high-traffic deployment, serve HTML with Brotli compression and a short revalidation
window. Serve versioned images with a long-lived immutable cache policy through a global
CDN. When replacing an asset in place, change its filename or shorten its cache lifetime
until all pages reference the new version.

## Code organization

Browser behavior lives in `assets/js/`: `daylight.js`, `clock.js`,
`calculator.js`, `alarm.js`, and `manual.js`. The clock and alarm share
`time.js`, which must load before either consumer. Each feature script is loaded at its
original position in its page, after the elements it uses. They are classic
scripts so opening the site directly from disk continues to work. Deploy the
`assets` directory together with the HTML. Styling stays within each page.

See [the architecture review](docs/architecture-review.md) for data flows,
prioritized risks, and the next refactoring steps.

## Regression tests

Run `node --test tests/*.test.cjs` from this directory (Node.js required
only for tests). No packages or build step are needed. Tests use controlled
browser boundaries; native dialog and audio behavior still need browser checks.

Malformed saved alarm records now fall back atomically to the default idle
five-minute timer. Valid saved records keep the existing format. Selecting a
preset cancels the current countdown or ringing and leaves its duration ready
for Set.

The manual controller owns its search metadata privately. Its index represents
static card content and is unaffected by highlight markup. If dynamic card
editing is introduced, rebuild that metadata before the next search. Page
styles and visibility listeners remain local to their distinct page/feature
behaviors.
