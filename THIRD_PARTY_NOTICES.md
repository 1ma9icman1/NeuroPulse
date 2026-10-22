# Third-party notices

## d3-celestial constellation line geometry

Files derived from the d3-celestial project by Olaf Frohn:
- `src/data/constellationLineData.ts` (constellation line coordinates and names)

Source files:
- https://github.com/ofrohn/d3-celestial/blob/master/data/constellations.lines.json
- https://github.com/ofrohn/d3-celestial/blob/master/data/constellations.json

Copyright (c) 2015, Olaf Frohn. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


## MapLibre GL JS

- Package: `maplibre-gl`
- License: BSD 3-Clause
- Project: https://github.com/maplibre/maplibre-gl-js

## Leaflet

- Package: `leaflet`
- License: BSD 2-Clause
- Project: https://github.com/Leaflet/Leaflet

## Natural Earth geographic data

- Dataset: Natural Earth 1:110m Admin 0 country boundaries, loaded from the Natural Earth Vector GeoJSON distribution.
- Public domain data.
- Project: https://www.naturalearthdata.com/
- GeoJSON source: https://github.com/nvkelso/natural-earth-vector

## Map tile imagery and terrain

- The Earth globe and site explorer request Esri World Imagery and World Topographic Map tiles at runtime.
- Attribution is displayed in the map controls. Tile use remains subject to Esri's current terms and service availability.
- Project/service information: https://www.arcgis.com/
- The road map layer uses OpenStreetMap tiles and displays OpenStreetMap attribution: https://www.openstreetmap.org/copyright


## Historical data sources and attribution

The historical layer manager can load user-provided GeoJSON files or GeoJSON URLs. Each imported dataset retains its upstream licensing and attribution requirements; users must confirm the terms for the specific export before redistribution.

- **OpenHistoricalMap:** live historical features are queried from the OpenHistoricalMap Overpass API. The project is public domain except where otherwise noted; preserve any source-specific attribution and terms. https://www.openhistoricalmap.org/copyright
- **Pleiades:** ancient place gazetteer and downloadable data. CC BY 3.0; provide attribution to the Pleiades contributors and link to the dataset. https://pleiades.stoa.org/downloads
- **Chronas:** historical geography data has dataset-specific attribution and share-alike requirements (CC BY-SA 4.0 for the Chronas API data described by its project). Review the current data license and underlying source attribution before use. https://github.com/Chronasorg/chronas-api
- **Stanford ORBIS:** ancient Roman transport network and travel-cost model. Use the terms and attribution provided by Stanford for the particular data export; the app does not assume a public, unrestricted GeoJSON API. https://orbis.stanford.edu/

Live availability, coverage, date precision, and licensing may vary by source. The app's timeline filters only features whose date properties are present and interpretable; it does not infer missing historical dates.
