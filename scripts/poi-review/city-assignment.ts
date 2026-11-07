export type PoiBoundary = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

type LocatedPoi = {
  city_id: string;
  latitude: number;
  longitude: number;
};

function pointInRing(longitude: number, latitude: number, ring: number[][]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index]!;
    const previousPoint = ring[previous]!;
    const currentLongitude = currentPoint[0]!;
    const currentLatitude = currentPoint[1]!;
    const previousLongitude = previousPoint[0]!;
    const previousLatitude = previousPoint[1]!;
    const crossesLatitude = (currentLatitude > latitude) !== (previousLatitude > latitude);
    if (!crossesLatitude) continue;
    const crossingLongitude = (previousLongitude - currentLongitude)
      * (latitude - currentLatitude) / (previousLatitude - currentLatitude)
      + currentLongitude;
    if (longitude < crossingLongitude) inside = !inside;
  }
  return inside;
}

function pointInPolygon(longitude: number, latitude: number, polygon: number[][][]): boolean {
  const [outerRing, ...holes] = polygon;
  return Boolean(outerRing && pointInRing(longitude, latitude, outerRing)
    && !holes.some((hole) => pointInRing(longitude, latitude, hole)));
}

export function pointInBoundary(
  longitude: number,
  latitude: number,
  boundary: PoiBoundary,
): boolean {
  const polygons = boundary.type === 'Polygon'
    ? [boundary.coordinates as number[][][]]
    : boundary.coordinates as number[][][][];
  return polygons.some((polygon) => pointInPolygon(longitude, latitude, polygon));
}

export function assignVaticanBoundaryPoisToRome<T extends LocatedPoi>(
  pois: T[],
  vaticanBoundary: PoiBoundary,
): T[] {
  return pois.map((poi) => poi.city_id === 'city-vatican-city'
    && !pointInBoundary(poi.longitude, poi.latitude, vaticanBoundary)
    ? { ...poi, city_id: 'city-rome' }
    : poi);
}
