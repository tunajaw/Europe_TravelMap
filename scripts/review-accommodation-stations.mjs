import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { matchesAddress } from './station-address-match.ts';

// Explicitly invoked, local-only enrichment. Never run in CI or the browser.
const root = resolve(import.meta.dirname, '..');
const cache = resolve(root, 'data/private/station-lookup');
await mkdir(cache, { recursive: true });
const source = parse(await readFile(resolve(root, 'data/private/accommodation-raw.csv'), 'utf8'), { bom: true, columns: true });
const data = JSON.parse(await readFile(resolve(root, 'public/data/travel-data.json'), 'utf8'));
const results = [];
let lastRequest = 0;

async function request(url, options = {}) {
  const key = createHash('sha256').update(url + JSON.stringify(options)).digest('hex');
  const file = resolve(cache, `${key}.json`);
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (process.argv.includes('--cached-only')) throw new Error('Missing local cache');
  await new Promise(resolve => setTimeout(resolve, Math.max(0, 1500 - (Date.now() - lastRequest))));
  lastRequest = Date.now();
  const response = await fetch(url, { ...options, headers: { 'User-Agent': 'EuropeTravelMap/1.0 (https://github.com/tunajaw/Europe_TravelMap)', ...options.headers }, signal: AbortSignal.timeout(55000) });
  if (!response.ok) throw new Error(`Service HTTP ${response.status}`);
  const value = await response.json();
  await writeFile(file, JSON.stringify(value), 'utf8');
  return value;
}

function distance(a, b) {
  const rad = x => x * Math.PI / 180;
  const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

for (const stay of data.accommodations) {
  const row = source[stay.sequence - 1];
  const city = data.cities.find(x => x.id === stay.cityId);
  const base = { accommodationId: stay.id, city: city.name, type: stay.type, status: 'needs_review', distanceMethod: 'straight-line', station: null };
  if (stay.type === 'Airport') {
    results.push({ ...base, status: 'not_applicable', airportCode: stay.airportCode });
    continue;
  }
  try {
    const address = row['住宿地址'].trim();
    if (!address) throw new Error('Missing address');
    const url = new URL('https://photon.komoot.io/api/');
    url.search = new URLSearchParams({ q: address, limit: '5', lat: String(city.location.latitude), lon: String(city.location.longitude) });
    const geo = await request(url.href);
    const nearby = geo.features.filter(x => distance(x.geometry.coordinates, [city.location.longitude, city.location.latitude]) < 30000);
    const matching = nearby.filter(x => matchesAddress(address, x.properties));
    const chosen = matching[0];
    if (!chosen) {
      results.push({ ...base, status: 'address_unresolved', candidateCount: nearby.length });
      console.log(`${stay.id}: address unresolved (${nearby.length} local candidates)`);
      continue;
    }
    const [lon, lat] = chosen.geometry.coordinates;
    const reverse = new URL('https://photon.komoot.io/reverse');
    reverse.search = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: '5', limit: '10' });
    for (const tag of ['railway:station', 'railway:halt', 'railway:tram_stop']) reverse.searchParams.append('osm_tag', tag);
    let response = await request(reverse.href);
    if (!response.features.length) {
      reverse.searchParams.delete('osm_tag');
      reverse.searchParams.set('radius', '1.5');
      for (const tag of ['highway:bus_stop', 'amenity:bus_station']) reverse.searchParams.append('osm_tag', tag);
      response = await request(reverse.href);
    }
    const stops = response.features.filter(x => x.properties.name).map(x => ({
      name: x.properties.name, type: x.properties.osm_key === 'railway' ? (x.properties.osm_value === 'tram_stop' ? 'tram' : 'rail_or_metro') : 'bus',
      distanceMetres: distance([lon, lat], x.geometry.coordinates),
      sourceUrl: `https://www.openstreetmap.org/${{N:'node',W:'way',R:'relation'}[x.properties.osm_type]}/${x.properties.osm_id}`,
    }));
    const rail = stops.filter(x => x.type !== 'bus');
    const candidates = (rail.length ? rail : stops).sort((a, b) => a.distanceMetres - b.distanceMetres)
      .map(stop => ({ ...stop, distanceMetres: Math.round(stop.distanceMetres / 10) * 10 }));
    const geocodeSourceUrl = `https://www.openstreetmap.org/${{N:'node',W:'way',R:'relation'}[chosen.properties.osm_type]}/${chosen.properties.osm_id}`;
    results.push({ ...base, status: candidates.length ? 'needs_review' : 'station_unresolved', station: candidates[0] ?? null, alternatives: candidates.slice(1, 3), searchRadiusMetres: rail.length ? 5000 : 1500, geocodeMatchCount: matching.length, geocodeSourceUrl });
    console.log(`${stay.id}: ${candidates.length ? 'station candidate found' : 'no station found'}`);
  } catch (error) {
    // Never log request URLs, query text, addresses or response bodies.
    results.push({ ...base, status: 'lookup_failed' });
    console.log(`${stay.id}: lookup failed (${error.message.startsWith('Service HTTP') ? error.message : error.name})`);
  }
  await writeFile(resolve(cache, 'review.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
}
await writeFile(resolve(cache, 'review.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(results.reduce((counts, row) => ({ ...counts, [row.status]: (counts[row.status] ?? 0) + 1 }), {})));
