# Yost Storage

A lightweight static website hosted at [ryost.us](https://ryost.us). No build step, no
dependencies, no third-party scripts — every page is a single self-contained HTML file.

## Pages

- `index.html` — **The Pack.** Landing page: a logo that swaps itself at sunrise and
  sunset, a large digital clock, a timer/alarm, and the **RLTW!** signoff.
- `PAWS_Training_Manual.html` — PAWS Service Dog Training Manual. Sticky header with
  live search and tab filtering, a sidebar table of contents, and session logs.
- `zsh_terminal_colorization_guide.html` — Walkthrough for switching to Zsh and
  colorizing the macOS Terminal prompt.

## Landing page

### Daylight logo swap

The logo and page palette follow the sun rather than a fixed clock time:

| | Logo | Background |
|---|---|---|
| Day | `HandlerPath_Gators.webp` | light (`#f3f3f3`) |
| Night | `gitlabrador.webp` | black, with a white ring around the mark |

The sun's altitude is computed in-page from the NOAA solar-position formulas using the
viewer's clock and time zone — no API call, no geolocation prompt, no network round
trip. Sunrise/sunset is taken at −0.833°, which puts the sun's upper limb on the
horizon with refraction included. It re-checks every minute and whenever the tab
regains focus.

Latitude is inferred from the IANA time zone and longitude from the standard-time UTC
offset (DST excluded, since that tracks longitude better). To pin the whole site to one
location's sun instead, set `LAT` and `LON` to fixed numbers near the top of the script.

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
- Set Alarm — opens the timer/alarm panel on the page rather than navigating

## Responsive behaviour

All three pages carry a viewport meta tag and are laid out fluidly.

- **Landing page** — below 720px the right-hand nav rail becomes a centred wrapped row
  and the footer returns to normal flow, since the rail would otherwise sit on top of
  the logo. The clock is `clamp(2.25rem, 11vw, 60pt)`, so it reaches its full 60pt on
  desktop without forcing a horizontal scrollbar on a phone. A
  `(min-width: 721px) and (max-height: 640px)` rule caps the logo for landscape phones,
  where the viewport is wide enough for the desktop layout but far too short for a
  full-size mark. The alarm card tightens below 420px.
- **PAWS manual** — breakpoints at 860px (sidebar collapses, topbar wraps) and 560px.
  Tables sit in `.tablewrap` scroll containers so the wide five-column table scrolls
  instead of crushing its columns. A print stylesheet strips the chrome.
- **Zsh guide** — breakpoint at 640px. The sample prompt is unbreakable monospace, so it
  scrolls in place rather than widening the page.

## Assets

| File | Used by |
|---|---|
| `HandlerPath_Gators.webp` | landing page, daytime logo |
| `gitlabrador.webp` | landing page, night logo and alarm flash |
| `favicon.png` | landing page favicon |
| `gitlabrador.jpg` | currently unreferenced |

The PAWS manual embeds its own hero logo as an inline base64 PNG and has no external
image dependencies.

## Local preview

No build step is required. Open `index.html` directly in a browser, or serve the
directory locally:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Deployment

Served as a static site; the `CNAME` file configures the custom domain as `ryost.us`.
