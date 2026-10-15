# Deepcore

A browser mining expedition about the cost of getting home. Drill through four strata, bring valuable ore to the surface, and turn your earnings into upgrades and an escape rocket. Heavy cargo slows your climb; gas, lava, hard landings, and an unstable Core Sample make the return journey matter.

## Run

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. No server-side application or account is needed. Audio unlocks on the first key or pointer interaction.

## Production

```sh
npm run build
```

Serve `dist/` with any static server. Asset URLs are relative, so the site also works inside a subdirectory. `npm run preview` serves the production bundle locally.

All original artwork, animation frames, live particle systems, sound cues, and the music bed are committed under `assets/`. Building only bundles these files; asset-generation tools are never required to install, build, or play. The optional one-time authoring recipes are in `scripts/art.py` and `scripts/effects.py`.

## Controls

| Input | Action |
| --- | --- |
| A / D or left / right | Walk; drill a wall when grounded against it |
| S or down | Drill downward while grounded |
| W / up / Space | Jetpack thrust |
| E / Enter | Activate a nearby building; confirm a menu or panel choice |
| I | Cargo inventory, ore discard, and field supplies |
| 1–6 | Dynamite, plastic explosives, quantum teleporter, matter transmitter, nanobots, emergency fuel |
| J | Jettison a carried Core Sample |
| Esc / P | Close a panel, pause, or resume |
| M | Mute |
| Up / down, Enter | Navigate menus and panel controls |
| Backtick | Engine diagnostics |

Pointer and touch operate the menus, panels, buildings, and status bar. Movement uses the keyboard.

Choose Standard or Hardcore, then Quick, Standard, or Marathon depth. Sell cargo at the Ore Market; purchase fuel and repairs at the Fuel Depot. The Save Pad writes one local save, when storage is available. Saving is refused while a Core Sample is live. Standard deaths allow restoring that save; Hardcore deaths delete it.

## Verification and captures

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests stand the actual engine over a native canvas with scripted clocks, keyboard events, local file decoding, and an in-memory storage adapter. They exercise the simulation, economy, persistence, hazards, and launch.

The `showcase/` carousel contains actual game screenshots and a four-second engine drawing replay. With the development server running, `node --experimental-strip-types scripts/capture.ts` captures a new staged dig using the engine's debug operations and recorder. The capture host is development-only; the published game has no global debug object.
