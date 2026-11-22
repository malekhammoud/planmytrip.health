/**
 * Shared map tile configuration for the route map and the location picker.
 *
 * Inputs: NEXT_PUBLIC_MAP_TILE_URL and NEXT_PUBLIC_MAP_ATTRIBUTION.
 * Outputs: one tile URL and attribution string.
 * Invariants: the public OSM endpoint is a development default only; production should
 * point both variables at a licensed provider.
 */

// VERIFY: Confirm the production tile licence, attribution text, and request volume with
// the chosen tile provider before launch. Public OSM tiles are not a high-volume endpoint.
export const MAP_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Required attribution text rendered by every Leaflet map. */
export const MAP_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
