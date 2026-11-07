import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { haversineKm } from '../preprocess/geo.ts';
import { extractResolvedGoogleMapsLocation, normalizeManualPoiName } from './manual-pois.ts';

type Poi = {
  poi_id: string;
  city_id: string;
  name: string;
  localized_name?: string | null;
  original_name?: string | null;
  latitude: number;
  longitude: number;
  subcategory: string;
};

type GeocodeResult = {
  lat: string;
  lon: string;
  display_name: string;
  namedetails?: Record<string, string>;
};

type CoordinateOverride = {
  poi_id: string;
  city_id: string;
  name: string;
  latitude: number;
  longitude: number;
  source_status: 'unreviewed_geocoding_candidate';
};

const root = resolve(import.meta.dirname, '..', '..');
const poiInput = resolve(root, 'data', 'parsed', 'poi_reference.json');
const reviewedInput = resolve(root, 'data', 'parsed', 'poi_reviewed_ids.json');
const discardedInput = resolve(root, 'data', 'parsed', 'poi_discarded_ids.json');
const travelDataInput = resolve(root, 'public', 'data', 'travel-data.json');
const output = resolve(root, 'data', 'parsed', 'poi_unreviewed_coordinate_overrides.json');
const reportOutput = resolve(root, 'data', 'private', 'poi-review', 'unreviewed-coordinate-recalibration.json');

const [pois, reviewedIds, discardedIds, travelData] = await Promise.all([
  readFile(poiInput, 'utf8').then(JSON.parse) as Promise<Poi[]>,
  readFile(reviewedInput, 'utf8').then(JSON.parse) as Promise<string[]>,
  readFile(discardedInput, 'utf8').then(JSON.parse) as Promise<string[]>,
  readFile(travelDataInput, 'utf8').then(JSON.parse) as Promise<{
    cities: Array<{
      id: string;
      name: string;
      location: { latitude: number; longitude: number };
    }>;
  }>,
]);
const protectedIds = new Set([...reviewedIds, ...discardedIds]);
const cities = new Map(travelData.cities.map((city) => [city.id, city]));
const candidates = pois.filter((poi) => !protectedIds.has(poi.poi_id)
  && poi.subcategory !== 'owner_confirmed_visit');

let existingOverrides: CoordinateOverride[] = [];
try {
  existingOverrides = JSON.parse(await readFile(output, 'utf8')) as CoordinateOverride[];
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const currentCandidateIds = new Set(candidates.map(({ poi_id: poiId }) => poiId));
existingOverrides = existingOverrides.filter(({ poi_id: poiId }) => currentCandidateIds.has(poiId));
const existingOverrideIds = new Set(existingOverrides.map(({ poi_id: poiId }) => poiId));

const delay = (milliseconds: number) => new Promise((done) => setTimeout(done, milliseconds));
const nameScore = (poi: Poi, result: GeocodeResult): number => {
  const queryNames = [poi.name, poi.localized_name, poi.original_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeManualPoiName);
  const resultNames = [result.display_name, ...Object.values(result.namedetails ?? {})]
    .map(normalizeManualPoiName);
  let best = 0;
  for (const query of queryNames) {
    const queryTokens = new Set(query.split(' ').filter(Boolean));
    for (const value of resultNames) {
      if (value === query) best = Math.max(best, 1);
      else if (value.includes(query) || query.includes(value)) best = Math.max(best, 0.94);
      else {
        const valueTokens = new Set(value.split(' ').filter(Boolean));
        const overlap = [...queryTokens].filter((token) => valueTokens.has(token)).length;
        best = Math.max(best, overlap / Math.max(1, queryTokens.size));
      }
    }
  }
  return best;
};

async function googleMapsCandidate(poi: Poi, city: {
  name: string;
  location: { latitude: number; longitude: number };
}): Promise<{ latitude: number; longitude: number; source: string; score: number }> {
  const query = `${poi.name}, ${city.name}`;
  const response = await fetch(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en,zh-TW;q=0.9' },
    signal: AbortSignal.timeout(30_000),
  });
  const html = await response.text();
  const href = html.match(/<link href="([^"]*tbm=map[^"]*)"/)?.[1]?.replaceAll('&amp;', '&');
  if (!href) throw new Error('Google Maps search endpoint was unavailable');
  const resultResponse = await fetch(new URL(href, 'https://www.google.com'), {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en,zh-TW;q=0.9' },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await resultResponse.text();
  const payload = JSON.parse(body.replace(/^\)\]\}'\s*/, '')) as unknown;
  const found: Array<{ latitude: number; longitude: number; label: string; score: number }> = [];
  const names = [poi.name, poi.localized_name, poi.original_name]
    .filter((value): value is string => Boolean(value?.trim()));
  const visit = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    const labels = node.filter((value): value is string => typeof value === 'string');
    const coordinates = node.filter((value): value is unknown[] => Array.isArray(value)
      && typeof value[2] === 'number' && typeof value[3] === 'number');
    for (const coordinate of coordinates) {
      const latitude = coordinate[2] as number;
      const longitude = coordinate[3] as number;
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180
        || haversineKm(city.location, { latitude, longitude }) > 120) continue;
      const candidate = { lat: String(latitude), lon: String(longitude), display_name: labels.join(' ') };
      found.push({
        latitude,
        longitude,
        label: labels.join(' ') || query,
        score: nameScore({ ...poi, name: names.join(' ') }, candidate),
      });
    }
    for (const child of node) visit(child);
  };
  visit(payload);
  const selected = found.sort((left, right) => right.score - left.score
    || haversineKm(city.location, left) - haversineKm(city.location, right))[0];
  if (!selected) throw new Error('Google Maps returned no City-region coordinate');
  return { ...selected, source: `Google Maps: ${selected.label}` };
}

const overrides: CoordinateOverride[] = [...existingOverrides];
const report: Array<Record<string, unknown>> = [];
for (const [index, poi] of candidates.entries()) {
  const city = cities.get(poi.city_id);
  if (!city) throw new Error(`Unknown City for POI recalibration: ${poi.city_id}`);
  if (existingOverrideIds.has(poi.poi_id)) {
    process.stdout.write(`[${index + 1}/${candidates.length}] Preserved ${city.name}: ${poi.name}\n`);
    continue;
  }
  try {
    let latitude: number;
    let longitude: number;
    let source: string;
    let score = 1;
    if (/^https:\/\/maps\.app\.goo\.gl\//.test(poi.name)) {
      const response = await fetch(poi.name, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Europe-TravelMap-POI-Recalibration/1.0' },
        signal: AbortSignal.timeout(30_000),
      });
      const location = response.headers.get('location');
      if (!location) throw new Error('Google Maps short link did not redirect');
      ({ latitude, longitude } = extractResolvedGoogleMapsLocation(location));
      source = 'google_maps_short_link';
    } else {
      const query = `${poi.name}, ${city.name}`;
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.search = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        limit: '8',
        addressdetails: '1',
        namedetails: '1',
      }).toString();
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Europe-TravelMap-POI-Recalibration/1.0 (local data QA)',
          'Accept-Language': 'en,zh-TW;q=0.9',
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
      const results = await response.json() as GeocodeResult[];
      const ranked = results.map((result) => {
        const coordinate = { latitude: Number(result.lat), longitude: Number(result.lon) };
        const cityDistanceKm = haversineKm(city.location, coordinate);
        return { result, coordinate, cityDistanceKm, score: nameScore(poi, result) };
      }).filter(({ coordinate, cityDistanceKm }) => Number.isFinite(coordinate.latitude)
        && Number.isFinite(coordinate.longitude) && cityDistanceKm <= 120)
        .sort((left, right) => right.score - left.score || left.cityDistanceKm - right.cityDistanceKm);
      const selected = ranked[0];
      if (selected) {
        ({ latitude, longitude } = selected.coordinate);
        score = selected.score;
        source = selected.result.display_name;
      } else {
        const google = await googleMapsCandidate(poi, city);
        ({ latitude, longitude, score, source } = google);
      }
    }
    const distanceMeters = Math.round(haversineKm(poi, { latitude, longitude }) * 1_000);
    overrides.push({
      poi_id: poi.poi_id,
      city_id: poi.city_id,
      name: poi.name,
      latitude,
      longitude,
      source_status: 'unreviewed_geocoding_candidate',
    });
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
    report.push({
      poi_id: poi.poi_id,
      city_id: poi.city_id,
      name: poi.name,
      old_latitude: poi.latitude,
      old_longitude: poi.longitude,
      candidate_latitude: latitude,
      candidate_longitude: longitude,
      distance_meters: distanceMeters,
      name_score: Number(score.toFixed(3)),
      source,
      status: 'candidate_applied_for_review',
    });
  } catch (error) {
    report.push({
      poi_id: poi.poi_id,
      city_id: poi.city_id,
      name: poi.name,
      status: 'unresolved',
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  process.stdout.write(`[${index + 1}/${candidates.length}] ${city.name}: ${poi.name}\n`);
  if (!existingOverrideIds.has(poi.poi_id)) await delay(1_050);
}

overrides.sort((left, right) => left.city_id.localeCompare(right.city_id)
  || left.name.localeCompare(right.name));
await mkdir(dirname(output), { recursive: true });
await mkdir(dirname(reportOutput), { recursive: true });
await writeFile(output, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
await writeFile(reportOutput, `${JSON.stringify({
  schema_version: 1,
  generated_at: new Date().toISOString(),
  candidates: candidates.length,
  resolved: overrides.length,
  unresolved: candidates.length - overrides.length,
  report,
}, null, 2)}\n`, 'utf8');
process.stdout.write(`Wrote ${overrides.length} unreviewed coordinate candidates; ${candidates.length - overrides.length} unresolved.\n`);
