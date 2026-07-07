# Stats & Weather — Fitbit OS app

A health-stats dashboard app for **Fitbit Versa 3** and **Fitbit Sense**. It shows the time,
today's steps / heart rate / calories / distance, battery, and current weather fetched by the
phone companion.

> **Why not Versa 4?** The Fitbit Versa 4 and Sense 2 do **not** support third-party apps —
> Fitbit closed them to third-party apps at launch. Only clock faces reach those devices, and
> only via a restricted, unofficial path. This project therefore targets the newest devices
> that *do* support publishable apps: Versa 3 (`atlas`) and Sense (`vulcan`).

## Project layout

| Path                  | Runs on | Purpose                                             |
| --------------------- | ------- | --------------------------------------------------- |
| `app/index.js`        | Watch   | Reads live stats, renders UI, requests weather.     |
| `resources/`          | Watch   | SVG UI (`index.view`), widgets, styles, app icon.   |
| `companion/index.js`  | Phone   | Fetches weather from Open-Meteo, sends to watch.    |
| `settings/index.jsx`  | Phone   | °C/°F toggle.                                       |
| `common/messages.ts`  | Shared  | Message contract between watch and phone.           |

## Prerequisites

- Node.js. **If `npm run build` fails on a very new Node version, use Node 16 or 18 LTS** — the
  Fitbit SDK CLI is sensitive to Node major versions.
- No weather account needed: weather comes from the keyless [Open-Meteo](https://open-meteo.com/) API.

## Build & run

```bash
npm install
npx fitbit          # opens the interactive Fitbit shell
# then, inside the shell:
#   build           # compiles for atlas + vulcan
#   install         # installs to the connected Simulator or device
```

Download the **Fitbit OS Simulator** from https://dev.fitbit.com/ to run without hardware. Weather
requires location access, which the Simulator provides via a mock position.

`npm run build` runs a one-shot build without the interactive shell.

## Publishing

1. Sign in to the [Fitbit Gallery App Manager (GAM)](https://gam.fitbit.com/).
2. Create an app entry; the SDK assigns an App ID on your first build.
3. Upload the build and **publish privately** first — installable via a direct link to test on a
   real Versa 3 / Sense.
4. **Submit for review** to publish **publicly** in the App Gallery (must meet the
   [App Gallery Guidelines](https://dev.fitbit.com/build/guides/publishing/)).
