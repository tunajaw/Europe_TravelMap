import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadReferences } from '../preprocess/references.ts';
import {
  extractResolvedGoogleMapsLocation,
  manualPoiId,
  parseManualPoiSource,
  type ManualPoiReference,
} from './manual-pois.ts';

const root = resolve(import.meta.dirname, '..', '..');
const input = resolve(root, 'data', 'raw', 'POIadd_v2.txt');
const output = resolve(root, 'data', 'parsed', 'manual_poi_reference.json');
const cityAliases = new Map([
  ['Karoly Vary', 'Karlovy Vary'],
  ['Vilinus', 'Vilnius'],
  ['Gorome', 'Göreme'],
  ['Spitzingsee', 'Schliersee'],
  ['Vatican City', 'Rome'],
]);

const source = await readFile(input, 'utf8');
const drafts = parseManualPoiSource(source);
const references = await loadReferences(root);
const rows: ManualPoiReference[] = new Array(drafts.length);
let nextIndex = 0;

async function resolveWorker(): Promise<void> {
  while (nextIndex < drafts.length) {
    const index = nextIndex++;
    const draft = drafts[index]!;
    const canonicalCity = cityAliases.get(draft.cityName) ?? draft.cityName;
    const city = references.cityIdByName.get(canonicalCity);
    if (!city) throw new Error(`Unknown manual POI City: ${draft.cityName}`);
    const response = await fetch(draft.shortUrl, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Europe-TravelMap-Manual-POI/1.0' },
      signal: AbortSignal.timeout(30_000),
    });
    const resolvedUrl = response.headers.get('location');
    if (!resolvedUrl || response.status < 300 || response.status >= 400) {
      throw new Error(`Google Maps short link did not redirect for ${draft.name}`);
    }
    const location = extractResolvedGoogleMapsLocation(resolvedUrl);
    rows[index] = {
      manual_id: manualPoiId(location.placeKey),
      city_id: city.id,
      name: draft.name,
      localized_name: draft.localizedName,
      latitude: location.latitude,
      longitude: location.longitude,
      operation: draft.operation,
      source_status: 'owner_confirmed_visit',
    };
    process.stdout.write(`[${index + 1}/${drafts.length}] Resolved ${canonicalCity}: ${draft.name}\n`);
  }
}

await Promise.all(Array.from({ length: 4 }, resolveWorker));
const london = references.cityIdByName.get('London');
if (!london) throw new Error('Missing London City reference');
for (const airportCode of ['LTN', 'STN', 'LGW']) {
  if (!new RegExp(`^\\s*\\*\\s+${airportCode} Airport\\s*$`, 'm').test(source)) continue;
  const airport = references.airports.find(({ code }) => code === airportCode);
  if (!airport) throw new Error(`Missing Airport reference: ${airportCode}`);
  rows.push({
    manual_id: `manual-poi-airport-${airportCode.toLowerCase()}`,
    city_id: london.id,
    name: `${airportCode} Airport`,
    localized_name: null,
    latitude: airport.location.latitude,
    longitude: airport.location.longitude,
    operation: 'add',
    source_status: 'owner_confirmed_visit',
  });
}
const ids = new Set(rows.map(({ manual_id }) => manual_id));
if (ids.size !== rows.length) throw new Error('Duplicate manual POI Google Maps place identity');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
process.stdout.write(`Wrote ${rows.length} owner-confirmed manual POIs to ${output}\n`);
