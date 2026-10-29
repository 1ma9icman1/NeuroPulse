#!/usr/bin/env Rscript
# Download real Copernicus DEM GeoTIFF tiles intersecting a GeoJSON AOI.
# Based on mlampros/CopernicusDEM (GPL-3); fetches official public AWS tiles.
#
# Usage:
#   Rscript scripts/prepare-copernicus-dem.R path/to/aoi.geojson public/copernicus-dem 90
#   Rscript scripts/prepare-copernicus-dem.R path/to/aoi.geojson public/copernicus-dem 30
#
# Requirements: R >= 3.5, AWS CLI v2, and R packages CopernicusDEM + sf.
# Downloads only tiles intersecting the AOI, not the whole planet.

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2 || length(args) > 3) {
  stop("Usage: Rscript scripts/prepare-copernicus-dem.R <aoi.geojson> <output-dir> [30|90]", call. = FALSE)
}
aoi_path <- normalizePath(args[[1]], mustWork = TRUE)
output_dir <- args[[2]]
resolution <- if (length(args) >= 3) as.integer(args[[3]]) else 90L
if (!resolution %in% c(30L, 90L)) stop("Resolution must be 30 or 90 metres.", call. = FALSE)
if (!requireNamespace("sf", quietly = TRUE)) stop("Missing R package 'sf'. Run install.packages('sf').", call. = FALSE)
if (!requireNamespace("CopernicusDEM", quietly = TRUE)) {
  stop("Missing R package 'CopernicusDEM'. Run install.packages('CopernicusDEM').", call. = FALSE)
}
if (!nzchar(Sys.which("aws"))) stop("AWS CLI was not found. Install AWS CLI v2 and verify aws --version.", call. = FALSE)

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
output_dir <- normalizePath(output_dir, winslash = "/", mustWork = TRUE)
aoi <- sf::st_read(aoi_path, quiet = TRUE)
if (is.na(sf::st_crs(aoi))) stop("AOI GeoJSON must declare a coordinate reference system.", call. = FALSE)
aoi <- sf::st_transform(aoi, 4326)
if (nrow(aoi) == 0) stop("AOI GeoJSON contains no features.", call. = FALSE)

cat(sprintf("Downloading real Copernicus DEM GLO-%s tiles intersecting %s\n",
            if (resolution == 30L) "30" else "90", aoi_path))
result <- CopernicusDEM::aoi_geom_save_tif_matches(
  sf_or_file = aoi,
  dir_save_tifs = output_dir,
  resolution = resolution,
  crs_value = 4326,
  threads = max(1L, parallel::detectCores(logical = FALSE)),
  verbose = TRUE
)
tifs <- sort(list.files(output_dir, pattern = "\\.tif(f)?$", full.names = FALSE, ignore.case = TRUE))
if (length(tifs) == 0) stop("No GeoTIFFs were produced; refusing to report success.", call. = FALSE)
manifest <- c(
  "{",
  sprintf('  "dataset": "Copernicus DEM GLO-%s",', if (resolution == 30L) "30" else "90"),
  sprintf('  "resolutionMeters": %d,', resolution),
  '  "source": "https://github.com/mlampros/CopernicusDEM",',
  '  "files": [',
  paste0('    "', gsub("\\\\", "/", tifs), '"', ifelse(seq_along(tifs) < length(tifs), ",", "")),
  "  ]",
  "}"
)
writeLines(manifest, file.path(output_dir, "manifest.json"), useBytes = TRUE)
cat(sprintf("SUCCESS: downloaded %d real Copernicus DEM GeoTIFF tile(s). Manifest: %s\n",
            length(tifs), file.path(output_dir, "manifest.json")))
