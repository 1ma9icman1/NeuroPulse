# Gaia Sky integration prototype

This proof of concept connects NeuroPulse's local Vite development app to the **desktop Gaia Sky** 3D universe application through Gaia Sky's documented REST API. It deliberately lives on `feature/gaiasky-integration-poc`; it does not replace the existing renderer or change the main branch.

## What is included

- A **GAIA SKY** panel in the NeuroPulse header.
- A local connection check.
- A focus-on-object command (for example, `Sirius`, `Earth`, or `Jupiter`, if that object is loaded in Gaia Sky).
- A simulation-year command. This prototype sets January 1 at 12:00 UTC for the selected year.
- A right-ascension/declination navigation test.
- A Vite development-server bridge with a small command allowlist. The webpage does not get a general-purpose pass-through to Gaia Sky's scripting API.

The browser/desktop relationship is intentionally local: the page sends requests to NeuroPulse's Vite server, which forwards only the approved commands to Gaia Sky's localhost REST API. The bridge rejects non-loopback Host/Origin values.

## Setup on Windows

1. Install a current Gaia Sky desktop release from [gaiasky.space](https://gaiasky.space/), or use the official source at [codeberg.org/gaiasky/gaiasky](https://codeberg.org/gaiasky/gaiasky). The linked `CanD42/gaiasky` repository is an older fork; it is not the implementation target for this prototype.
2. Start Gaia Sky.
3. In Gaia Sky preferences, open the REST server settings and enable the REST server. **Keep the loopback-only / localhost-only setting enabled.** The documented default REST port is `34487`.
4. Pull this branch and start NeuroPulse from your local folder:

   ```powershell
   cd "E:\!projectz\NeuroPulse-EarthCore"
   git fetch origin
   git switch feature/gaiasky-integration-poc
   git pull origin feature/gaiasky-integration-poc
   npm install
   npm run lint
   npm run build
   npm run dev
   ```

5. Open `http://localhost:3000`, click **GAIA SKY**, and press the refresh button if the initial check finishes before Gaia Sky is ready.

If Gaia Sky is configured to use a different port, set the environment variable **before** starting Vite:

```powershell
$env:GAIASKY_REST_PORT = "34487"
npm run dev
```

Replace `34487` with the port shown in Gaia Sky's preferences. The default is already `34487`.

## First smoke tests

1. The panel should report **GAIA SKY CONNECTED**.
2. Enter `Sirius` in *Navigate to an object* and press **FOCUS**. Gaia Sky should focus on Sirius if its catalog/dataset is loaded.
3. Set a different year, such as `-3000`, and press **SET TIME**. Gaia Sky should receive the timestamp for January 1 at 12:00 UTC of that year.
4. Use the coordinate test with RA `101.287` and declination `-16.716` to point approximately toward Sirius.

Gaia Sky's currently documented sky-coordinate API accepts integer degrees, so the bridge rounds the coordinate test to integers. Do not treat this as precision astrometry; the API contract needs a more precise route before mapping every NeuroPulse catalog coordinate.

## Next integration milestone

After the basic smoke tests pass, connect the existing NeuroPulse state to this bridge:

- Forward the selected NeuroPulse star coordinates to Gaia Sky.
- Synchronize the historical timeline rather than keeping the two year controls independent.
- Add and update stable A/B/C markers and their connecting geometry using Gaia Sky's supported scene API, after validating its coordinate/reference-system conversion.
- Add an explicit disconnect/status path and handle Gaia Sky closing while NeuroPulse remains open.

A screenshot/video stream or direct embedding of Gaia Sky is **not** included. Gaia Sky uses a native desktop rendering stack; this prototype controls the desktop process through its API rather than trying to embed Java/libGDX as a React canvas.

## Security and licensing

Gaia Sky warns that its REST API can expose powerful scripting operations. Do not disable its localhost-only restriction or expose its REST port to your LAN or the internet. The bridge is available only from the local Vite development server and uses an allowlist for supported commands.

Gaia Sky's application source is published under **MPL-2.0**. Preserve its notices if source is copied or modified; separately verify licenses for any data catalogs or textures used. This proof of concept calls the API and does not copy Gaia Sky source code.

## Official references

- [Gaia Sky source (official Codeberg repository)](https://codeberg.org/gaiasky/gaiasky)
- [Gaia Sky REST server documentation](https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/REST-server.html)
- [Gaia Sky APIv2 documentation](https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/APIv2.html)
- [Camera APIv2 methods](https://gaia.ari.uni-heidelberg.de/gaiasky/docs/javadoc/latest/gaiasky/script/v2/impl/CameraModule.html)
- [Time APIv2 methods](https://gaia.ari.uni-heidelberg.de/gaiasky/docs/javadoc/latest/gaiasky/script/v2/impl/TimeModule.html)
- [Scene APIv2 methods](https://gaia.ari.uni-heidelberg.de/gaiasky/docs/javadoc/latest/gaiasky/script/v2/impl/SceneModule.html)
