# CesiumJS + Copernicus DEM local terrain pipeline

This branch keeps the existing Three.js Elevation view and all its controls intact while adding the dependencies and Windows-side data preparation needed for a CesiumJS terrain renderer.

## Roles of the two upstream projects

- [CesiumJS](https://github.com/CesiumGS/cesium) is the browser-side globe/rendering engine. It does not itself provide Copernicus GeoTIFF data, and its standard terrain provider expects terrain tiles in Cesium's terrain format rather than arbitrary GeoTIFF files.
- [CopernicusDEM](https://github.com/mlampros/CopernicusDEM) is an **R package**, not a JavaScript library. It uses AWS CLI to download real Copernicus GLO-30 or GLO-90 GeoTIFF tiles intersecting an area of interest (AOI). It is GPL-3 licensed.

The current integration path is: acquire actual AOI GeoTIFFs with CopernicusDEM, then open **CESIUM DEM DETAIL** from Water / Dirt Elevation to render a terrain mesh made from the downloaded raster samples. The detail mesh is display-resampled to 129×129 vertices per tile for browser performance; the original GeoTIFF remains untouched. The download step must remain AOI-based; the upstream package notes that global tile downloads are very large.

## Windows setup

1. Install [R for Windows](https://cran.r-project.org/bin/windows/base/).
2. Install [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html). The upstream package uses AWS CLI for downloads; follow its README for AWS CLI configuration if the package reports missing credentials. The DEM bucket is public, but the R package's CLI invocation does not expose an anonymous-request flag.
3. In R, install the package requirements:

   ```r
   install.packages(c("sf", "CopernicusDEM"))
   ```

4. Create a GeoJSON polygon for the area to download. It must include a CRS (normally WGS84 / EPSG:4326).
5. From the NeuroPulse root, run:

   ```powershell
   Rscript scripts/prepare-copernicus-dem.R .\data\giza-aoi.geojson .\public\copernicus-dem 30
   ```

   Use `90` instead of `30` for smaller downloads. Output includes the source GeoTIFF tiles and a `manifest.json`.

## Important status

The local preview renders a Cesium primitive mesh from measured GeoTIFF samples; it is not yet a native quantized-mesh terrain provider. The existing elevation globe remains the default and all its controls are retained. The preview requires locally downloaded tiles and shows an explicit error when they are absent; it does not substitute fake terrain.
