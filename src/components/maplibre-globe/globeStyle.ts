import type { StyleSpecification } from 'maplibre-gl';

/**
 * ESRI World Imagery — free, no API key, real satellite/aerial tiles up to
 * zoom 19 in most populated areas. Pure imagery layer only: no roads, no
 * labels, no country borders (those live in a separate ESRI reference layer
 * that we deliberately never add).
 */
export const ESRI_ATTRIBUTION = 'Esri, Maxar, Earthstar Geographics, and the GIS User Community';

const ESRI_IMAGERY_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const globeStyle: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: [ESRI_IMAGERY_URL],
      tileSize: 256,
      maxzoom: 19,
      attribution: ESRI_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: 'esri-imagery-layer',
      type: 'raster',
      source: 'esri-imagery',
      paint: {
        'raster-fade-duration': 0,
      },
    },
  ],
  sky: {
    'sky-color': '#e8f4f8',
    'horizon-color': '#e8f4f8',
    'fog-color': '#e8f4f8',
  },
};
