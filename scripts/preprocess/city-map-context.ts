import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

type Coordinate = [number, number];
type Geometry =
  | { type: 'Polygon'; coordinates: Coordinate[][] }
  | { type: 'MultiPolygon'; coordinates: Coordinate[][][] };
type NominatimResult = {
  osm_type: string;
  osm_id: number;
  display_name: string;
  category: string;
  type: string;
  geojson?: Geometry;
};

const root = resolve(import.meta.dirname, '..', '..');
const travelData = JSON.parse(await readFile(join(root, 'public', 'data', 'travel-data.json'), 'utf8')) as {
  countries: Array<{ id: string; name: string }>;
  cities: Array<{ id: string; name: string; countryId: string; location: { latitude: number; longitude: number } }>;
};
const output = join(root, 'data', 'parsed', 'city_map_context.json');
const cacheDir = join(root, 'data', 'generated', 'city-map-context');
const aliases = new Map([['city-andorra', 'Andorra la Vella']]);
const countryBoundaryCities = new Set(['city-vatican-city']);
const boundaryOsmIds = new Map([['city-vatican-city', 'R36989']]);
const cityIds = travelData.cities.map(({ id }) => id).sort();

function isBoundary(result: NominatimResult): result is NominatimResult & { geojson: Geometry } {
  return (result.geojson?.type === 'Polygon' || result.geojson?.type === 'MultiPolygon')
    && (result.category === 'boundary' || result.category === 'place');
}

function pointSegmentDistanceSquared(point: Coordinate, start: Coordinate, end: Coordinate): number {
  const segmentX = end[0] - start[0];
  const segmentY = end[1] - start[1];
  if (segmentX === 0 && segmentY === 0) return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  const projection = Math.max(0, Math.min(1,
    ((point[0] - start[0]) * segmentX + (point[1] - start[1]) * segmentY) / (segmentX ** 2 + segmentY ** 2)));
  const projectedX = start[0] + projection * segmentX;
  const projectedY = start[1] + projection * segmentY;
  return (point[0] - projectedX) ** 2 + (point[1] - projectedY) ** 2;
}

function simplifyLine(points: Coordinate[], toleranceSquared: number): Coordinate[] {
  if (points.length <= 2) return points;
  let farthestIndex = 0;
  let farthestDistance = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointSegmentDistanceSquared(points[index]!, points[0]!, points.at(-1)!);
    if (distance > farthestDistance) { farthestDistance = distance; farthestIndex = index; }
  }
  if (farthestDistance <= toleranceSquared) return [points[0]!, points.at(-1)!];
  return [
    ...simplifyLine(points.slice(0, farthestIndex + 1), toleranceSquared).slice(0, -1),
    ...simplifyLine(points.slice(farthestIndex), toleranceSquared),
  ];
}

function simplifyRing(ring: Coordinate[], tolerance = 0.00035): Coordinate[] {
  const open = ring[0]?.[0] === ring.at(-1)?.[0] && ring[0]?.[1] === ring.at(-1)?.[1]
    ? ring.slice(0, -1) : ring;
  if (open.length <= 4) return [...open, open[0]!];
  const origin = open[0]!;
  let opposite = 1;
  for (let index = 2; index < open.length; index += 1) {
    const distance = (open[index]![0] - origin[0]) ** 2 + (open[index]![1] - origin[1]) ** 2;
    const current = (open[opposite]![0] - origin[0]) ** 2 + (open[opposite]![1] - origin[1]) ** 2;
    if (distance > current) opposite = index;
  }
  const first = simplifyLine(open.slice(0, opposite + 1), tolerance ** 2);
  const second = simplifyLine([...open.slice(opposite), origin], tolerance ** 2);
  const simplified = [...first.slice(0, -1), ...second];
  return simplified.length >= 4 ? simplified : [...open, origin];
}

function simplifyGeometry(geometry: Geometry): Geometry {
  if (geometry.type === 'Polygon') {
    return { type: geometry.type, coordinates: geometry.coordinates.map((ring) => simplifyRing(ring)) };
  }
  return { type: geometry.type, coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => simplifyRing(ring))) };
}

function localExtent(latitude: number, longitude: number, radiusKm = 5): Geometry {
  const latitudeDelta = radiusKm / 111.32;
  const longitudeDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos(latitude * Math.PI / 180)));
  return { type: 'Polygon', coordinates: [[
    [longitude - longitudeDelta, latitude - latitudeDelta],
    [longitude + longitudeDelta, latitude - latitudeDelta],
    [longitude + longitudeDelta, latitude + latitudeDelta],
    [longitude - longitudeDelta, latitude + latitudeDelta],
    [longitude - longitudeDelta, latitude - latitudeDelta],
  ]] };
}

async function boundaryFor(cityId: string): Promise<(NominatimResult & { geojson: Geometry }) | null> {
  const cachePath = join(cacheDir, `${cityId}.json`);
  let results: NominatimResult[];
  try {
    results = JSON.parse(await readFile(cachePath, 'utf8')) as NominatimResult[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    results = [];
  }
  let boundary = results.find(isBoundary);
  if (!boundary && (results.length === 0 || countryBoundaryCities.has(cityId))) {
    const city = travelData.cities.find(({ id }) => id === cityId);
    if (!city) throw new Error(`Unknown City Map context City: ${cityId}`);
    const country = travelData.countries.find(({ id }) => id === city.countryId);
    if (!country) throw new Error(`Unknown City Map context Country: ${city.countryId}`);
    const query = `${aliases.get(city.id) ?? city.name}, ${country.name}`;
    const explicitOsmId = boundaryOsmIds.get(cityId);
    const url = new URL(explicitOsmId
      ? 'https://nominatim.openstreetmap.org/lookup'
      : 'https://nominatim.openstreetmap.org/search');
    const parameters: Record<string, string> = {
      format: 'jsonv2',
      polygon_geojson: '1',
      polygon_threshold: '0.00015',
    };
    if (explicitOsmId) parameters.osm_ids = explicitOsmId;
    else {
      parameters.q = query;
      parameters.limit = '5';
      if (!countryBoundaryCities.has(cityId)) parameters.featuretype = 'city';
    }
    url.search = new URLSearchParams(parameters).toString();
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Europe-TravelMap-City-Context/1.0' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}: ${await response.text()}`);
    results = await response.json() as NominatimResult[];
    await writeFile(cachePath, `${JSON.stringify(results)}\n`, 'utf8');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_100));
    boundary = results.find(isBoundary);
  }
  return boundary ?? null;
}

await mkdir(cacheDir, { recursive: true });
const contexts = [];
for (const [index, cityId] of cityIds.entries()) {
  process.stdout.write(`[${index + 1}/${cityIds.length}] OSM boundary ${cityId}\n`);
  const boundary = await boundaryFor(cityId);
  const city = travelData.cities.find(({ id }) => id === cityId)!;
  if (boundary) {
    contexts.push({
      city_id: cityId,
      kind: 'administrative_boundary',
      source: 'OpenStreetMap',
      source_osm_id: `${boundary.osm_type}/${boundary.osm_id}`,
      source_label: boundary.display_name,
      boundary: simplifyGeometry(boundary.geojson),
    });
  } else {
    process.stdout.write('  No administrative boundary; using a reviewed-reference local extent.\n');
    contexts.push({
      city_id: cityId,
      kind: 'local_extent',
      source: 'Reviewed city reference',
      source_osm_id: null,
      source_label: `${city.name} local context`,
      boundary: localExtent(city.location.latitude, city.location.longitude),
    });
  }
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(contexts, null, 2)}\n`, 'utf8');
process.stdout.write(`Wrote ${contexts.length} City Map boundaries to ${output}\n`);
