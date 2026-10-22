import type { TravelData } from '../../domain/travel-data.ts';

export const CITY_MAP_WIDTH = 1000;
export const CITY_MAP_HEIGHT = 380;

export type CityGeoViewport = { west: number; south: number; east: number; north: number };
export type CityMapBox = { startX: number; startY: number; endX: number; endY: number };
type Poi = NonNullable<TravelData['pois']>[number];
type Boundary = NonNullable<TravelData['cityContexts']>[number]['boundary'];
export type CityMapTile = { key: string; href: string; x: number; y: number; width: number; height: number };

function pointInRing(point: { latitude: number; longitude: number }, ring: [number, number][]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index]!;
    const [previousX, previousY] = ring[previous]!;
    if ((y > point.latitude) !== (previousY > point.latitude)
      && point.longitude < (previousX - x) * (point.latitude - y) / (previousY - y) + x) inside = !inside;
  }
  return inside;
}

function ringArea(ring: [number, number][]): number {
  return Math.abs(ring.reduce((sum, [x, y], index) => {
    const [nextX, nextY] = ring[(index + 1) % ring.length]!;
    return sum + x * nextY - nextX * y;
  }, 0) / 2);
}

function boundaryLocations(boundary: Boundary | undefined, center: { latitude: number; longitude: number }): Array<{ latitude: number; longitude: number }> {
  if (!boundary) return [];
  const polygons = boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates;
  const primary = polygons.find((polygon) => pointInRing(center, polygon[0]!))
    ?? [...polygons].sort((left, right) => ringArea(right[0]!) - ringArea(left[0]!))[0]!;
  return primary.flatMap((ring) => ring.map(([longitude, latitude]) => ({ latitude, longitude })));
}

export function cityPoiViewport(
  city: TravelData['cities'][number],
  pois: Poi[],
  boundary?: Boundary,
): CityGeoViewport {
  const contextLocations = boundaryLocations(boundary, city.location);
  const poiLocations = pois.map((poi) => poi.location);
  const locations = poiLocations.length ? poiLocations : contextLocations;
  if (!locations.length) locations.push(city.location);
  const latitudes = locations.map((location) => location.latitude);
  const longitudes = locations.map((location) => location.longitude);
  const centerLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const cosine = Math.max(0.35, Math.cos(centerLatitude * Math.PI / 180));
  let latitudeSpan = Math.max(0.02, Math.max(...latitudes) - Math.min(...latitudes));
  let longitudeSpan = Math.max(0.02 / cosine, Math.max(...longitudes) - Math.min(...longitudes));
  const targetAspect = CITY_MAP_WIDTH / CITY_MAP_HEIGHT;
  const metricAspect = longitudeSpan * cosine / latitudeSpan;
  if (metricAspect < targetAspect) longitudeSpan = latitudeSpan * targetAspect / cosine;
  else latitudeSpan = longitudeSpan * cosine / targetAspect;
  latitudeSpan *= 1.2;
  longitudeSpan *= 1.2;
  const centerLongitude = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
  return {
    west: centerLongitude - longitudeSpan / 2,
    east: centerLongitude + longitudeSpan / 2,
    south: centerLatitude - latitudeSpan / 2,
    north: centerLatitude + latitudeSpan / 2,
  };
}

export function cityBoundaryPath(boundary: Boundary, viewport: CityGeoViewport): string {
  const polygons = boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates;
  return polygons.map((polygon) => polygon.map((ring) => ring.map(([longitude, latitude], index) => {
    const [x, y] = projectCityPoint({ longitude, latitude }, viewport);
    return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ') + ' Z').join(' ')).join(' ');
}

export function zoomViewportFromBox(
  viewport: CityGeoViewport,
  box: CityMapBox,
  width = CITY_MAP_WIDTH,
  height = CITY_MAP_HEIGHT,
): CityGeoViewport | null {
  const left = Math.max(0, Math.min(width, Math.min(box.startX, box.endX)));
  const right = Math.max(0, Math.min(width, Math.max(box.startX, box.endX)));
  const top = Math.max(0, Math.min(height, Math.min(box.startY, box.endY)));
  const bottom = Math.max(0, Math.min(height, Math.max(box.startY, box.endY)));
  if (right - left < 12 || bottom - top < 12) return null;

  const scale = Math.max((right - left) / width, (bottom - top) / height);
  const longitudeSpan = (viewport.east - viewport.west) * scale;
  const latitudeSpan = (viewport.north - viewport.south) * scale;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const centerLongitude = viewport.west + centerX / width * (viewport.east - viewport.west);
  const centerLatitude = viewport.north - centerY / height * (viewport.north - viewport.south);
  return {
    west: centerLongitude - longitudeSpan / 2,
    east: centerLongitude + longitudeSpan / 2,
    south: centerLatitude - latitudeSpan / 2,
    north: centerLatitude + latitudeSpan / 2,
  };
}

export function zoomViewportAtPoint(
  viewport: CityGeoViewport,
  x: number,
  y: number,
  factor: number,
  width = CITY_MAP_WIDTH,
  height = CITY_MAP_HEIGHT,
): CityGeoViewport {
  const clampedX = Math.max(0, Math.min(width, x));
  const clampedY = Math.max(0, Math.min(height, y));
  const longitudeSpan = Math.max(0.001, (viewport.east - viewport.west) * factor);
  const latitudeSpan = Math.max(0.001, (viewport.north - viewport.south) * factor);
  const anchorLongitude = viewport.west + clampedX / width * (viewport.east - viewport.west);
  const anchorLatitude = viewport.north - clampedY / height * (viewport.north - viewport.south);
  return {
    west: anchorLongitude - clampedX / width * longitudeSpan,
    east: anchorLongitude + (1 - clampedX / width) * longitudeSpan,
    south: anchorLatitude - (1 - clampedY / height) * latitudeSpan,
    north: anchorLatitude + clampedY / height * latitudeSpan,
  };
}

export function interpolateViewport(
  start: CityGeoViewport,
  end: CityGeoViewport,
  progress: number,
): CityGeoViewport {
  const amount = Math.max(0, Math.min(1, progress));
  const interpolate = (from: number, to: number) => from + (to - from) * amount;
  return {
    west: interpolate(start.west, end.west),
    south: interpolate(start.south, end.south),
    east: interpolate(start.east, end.east),
    north: interpolate(start.north, end.north),
  };
}

function mercatorTileY(latitude: number): number {
  const radians = Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180;
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
}

export function cityMapTiles(
  viewport: CityGeoViewport,
  width = CITY_MAP_WIDTH,
  height = CITY_MAP_HEIGHT,
): CityMapTile[] {
  const longitudeFraction = Math.max(1e-6, (viewport.east - viewport.west) / 360);
  const northY = mercatorTileY(viewport.north);
  const southY = mercatorTileY(viewport.south);
  const latitudeFraction = Math.max(1e-6, southY - northY);
  const zoom = Math.max(3, Math.min(16, Math.floor(Math.min(
    Math.log2(width / 256 / longitudeFraction),
    Math.log2(height / 256 / latitudeFraction),
  ))));
  const scale = 2 ** zoom;
  const westX = (viewport.west + 180) / 360 * scale;
  const eastX = (viewport.east + 180) / 360 * scale;
  const topY = northY * scale;
  const bottomY = southY * scale;
  const tileWidth = width / (eastX - westX);
  const tileHeight = height / (bottomY - topY);
  const tiles: CityMapTile[] = [];
  for (let tileY = Math.floor(topY); tileY <= Math.floor(bottomY); tileY += 1) {
    if (tileY < 0 || tileY >= scale) continue;
    for (let tileX = Math.floor(westX); tileX <= Math.floor(eastX); tileX += 1) {
      const wrappedX = ((tileX % scale) + scale) % scale;
      tiles.push({
        key: `${zoom}/${wrappedX}/${tileY}`,
        href: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
        x: (tileX - westX) * tileWidth,
        y: (tileY - topY) * tileHeight,
        width: tileWidth,
        height: tileHeight,
      });
    }
  }
  return tiles;
}

export function projectCityPoint(
  location: { latitude: number; longitude: number },
  viewport: CityGeoViewport,
): [number, number] {
  return [
    (location.longitude - viewport.west) / (viewport.east - viewport.west) * CITY_MAP_WIDTH,
    (viewport.north - location.latitude) / (viewport.north - viewport.south) * CITY_MAP_HEIGHT,
  ];
}
