# CesiumJS + Copernicus DEM local terrain pipeline

This branch keeps the existing Three.js Elevation view and all its controls intact while adding the dependencies and Windows-side data preparation needed for a CesiumJS terrain renderer.

## Roles of the two upstream projects

- [CesiumJS](https://github.com/CesiumGS/cesium) is the browser-side globe/rendering engine. It does not itself provide Copernicus GeoTIFF data, and its standard terrain provider expects terrain tiles in Cesium's terrain format rather than arbitrary GeoTIFF files.
- [CopernicusDEM](https://github.com/mlampros/CopernicusDEM) is an **R package**, not a JavaScript library. It uses AWS CLI to download real Copernicus GLO-30 or GLO-90 GeoTIFF tiles intersecting an area of interest (AOI). It is GPL-3 licensed.

The intended integration is therefore: acquire actual AOI GeoTIFFs with CopernicusDEM, read their measured raster samples, and feed those samples into a Cesium terrain layer. The download step must remain AOI-based; the upstream package notes that global tile downloads are very large.

## Windows setup

1. Install [R for Windows](https://cran.r-project.org/bin/windows/base/).
2. Install [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html). The upstream CopernicusDEM package uses it to copy public AWS objects; public-data reads do not require personal AWS credentials.
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

This is a data-acquisition foundation, not a claim that raw GeoTIFFs are already being used as Cesium's native terrain provider. Cesium integration must explicitly convert/read the downloaded GeoTIFF samples into a terrain mesh or a supported Cesium terrain tile format. The existing elevation globe remains the default and is not replaced by a mock terrain surface.
