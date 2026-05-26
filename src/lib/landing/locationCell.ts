import { latLonToTileXY } from "@/lib/earth/tileImagery";

export const LANDING_LIBRARY_ZOOM = 11;
export const LANDING_TILE_GRID = 3;

export type LandingBodyId = "earth";

export type LandingCell = {
  bodyId: LandingBodyId;
  zoom: number;
  tileX: number;
  tileY: number;
  cellId: string;
  lat: number;
  lon: number;
};

export function buildLandingCell(
  bodyId: LandingBodyId,
  lat: number,
  lon: number,
  zoom = LANDING_LIBRARY_ZOOM,
): LandingCell {
  const { x, y } = latLonToTileXY(lat, lon, zoom);
  return {
    bodyId,
    zoom,
    tileX: x,
    tileY: y,
    cellId: `${bodyId}:z${zoom}:${x}:${y}`,
    lat,
    lon,
  };
}

export function landingNeighborCellIds(cell: LandingCell): string[] {
  const ids: string[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      ids.push(`${cell.bodyId}:z${cell.zoom}:${cell.tileX + dx}:${cell.tileY + dy}`);
    }
  }
  return ids;
}

export function readEarthRegionHintAtLatLon(lat: number, lon: number): string {
  const latBand =
    Math.abs(lat) > 60
      ? "polar"
      : Math.abs(lat) > 30
        ? "mid-latitude"
        : "equatorial";
  const lonBand =
    lon > -30 && lon < 60 ? "Africa–Europe" : lon < -60 ? "Americas" : "Pacific–Asia";
  return `${latBand} ${lonBand}`;
}
