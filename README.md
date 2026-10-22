# NeuroPulse / AudioCube Space

NeuroPulse is a local React + Vite application combining the AudioCube spatial-audio interface with an Earth/star exploration view and an experimental Sun-centered planetary view.

## Current working branch

Use **`feature/gaiasky-integration-poc`** for the current work. This branch contains the Earth/star interface refinements, the optional HYG star catalog, the experimental textured planetary simulation, and the local Gaia Sky REST bridge prototype.

Do not switch to `main` or merge this branch as part of routine local setup. The repository's default branch is not the active work branch.

## Run locally on Windows

Open PowerShell:

```powershell
cd "E:\!projectz\NeuroPulse-EarthCore"
git fetch origin
git switch feature/gaiasky-integration-poc
git pull origin feature/gaiasky-integration-poc
npm install
npm run lint
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed" }
npm run dev
```

Open **http://localhost:3000**. Vite is configured to bind to `127.0.0.1`, so the development server is local to this computer.

- `npm run dev` starts the development server.
- `npm run lint` runs the TypeScript no-emit check.
- `npm run build` generates the production bundle.
- `npm run preview` previews the production build.
- `npm run clean` removes generated `dist` and `server.js` output on supported shells.

## Current features in this branch

- AudioCube Space UI with its A/B/C channel-position controls.
- Earth/top-plane view, named historical/site markers, sky-star overlay, and the continuous day-rotation timeline.
- Optional **ALL STARS** catalog button. The HYG catalog is fetched only when enabled; its distance slider reveals stars from nearer to farther away.
- Experimental Sun-centered planetary scene with elliptical orbit paths, date/speed controls, planet and Moon textures, and an approximate tidal-lock representation.
- **GAIA SKY** panel/prototype for controlling a separately running Gaia Sky desktop application via a restricted local REST bridge.

## Important limitations

- The ALL STARS action downloads a roughly 32 MB remote CSV on first use and depends on the remote HYG source being reachable. It is a catalog of stars with usable distance data, not an exhaustive database of every Milky Way star. Star placements are projected into the interface's visual coordinate space.
- The planetary view is an educational visual simulation, not a precision ephemeris or N-body gravity simulator. Orbit scales and planet sizes are visually compressed.
- Planet/moon surface maps are loaded from public Solar System Scope texture URLs with procedural fallbacks. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for licensing/attribution.
- Gaia Sky must be installed and running separately, with its REST server enabled on loopback (default port `34487`). The browser-to-desktop workflow has not been confirmed by an end-to-end manual test; see [docs/GAIA_SKY_INTEGRATION.md](docs/GAIA_SKY_INTEGRATION.md).
- Passing CI proves type-check/build success only. It does not verify visual quality, remote texture/catalog availability, audio hardware playback, or real desktop Gaia Sky connection.

## Next-session notes

Start with [docs/NEXT_SESSION.md](docs/NEXT_SESSION.md). It records the current branch and commit, known limitations, verified checks, and a short manual test checklist.
