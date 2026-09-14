import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const folder = resolve(root, 'data/private/station-lookup');
const candidates = JSON.parse(await readFile(resolve(folder, 'review.json'), 'utf8'));
const approvedStations = JSON.parse(await readFile(
  resolve(root, 'data/parsed/accommodation_station_reference.json'),
  'utf8',
));
let owner = { confirmed: {}, pending: {} };
try {
  owner = JSON.parse(await readFile(resolve(folder, 'owner-stations.json'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
for (const id of [...Object.keys(owner.confirmed), ...Object.keys(owner.pending)]) {
  if (!candidates.some(row => row.accommodationId === id)) throw new Error(`Unknown Accommodation override: ${id}`);
}
const results = candidates.map(row => {
  if (!(row.accommodationId in approvedStations)) {
    throw new Error(`Missing approved Accommodation station reference: ${row.accommodationId}`);
  }
  const approvedName = approvedStations[row.accommodationId];
  if (approvedName === null) {
    if (row.type !== 'Airport') throw new Error(`Unexpected not-applicable station: ${row.accommodationId}`);
    return { ...row, status: 'not_applicable' };
  }
  const name = owner.confirmed[row.accommodationId];
  if (name) return {
    ...row, status: 'approved', distanceMethod: null,
    station: { name, type: null, distanceMetres: null, sourceUrl: null },
    alternatives: [], source: 'owner',
  };
  if (row.station?.name !== approvedName) {
    throw new Error(`Approved station differs from lookup candidate: ${row.accommodationId}`);
  }
  return { ...row, status: 'approved', source: 'reviewed_lookup' };
});
if (Object.keys(approvedStations).length !== results.length) {
  throw new Error('Approved Accommodation station references do not exactly cover lookup results');
}
const clean = text => String(text ?? '-').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
const lines = [
  '# Accommodation station candidates', '',
  'Local review only. All non-Airport station names below are owner-approved public metadata.',
  'Owner corrections override lookup names; previous candidate distances, kinds and station links are cleared.', '',
  'Distances are approximate straight-line distances rounded to 10 m, not walking routes or commute minutes.',
  'Rail includes mainline rail, metro and tram. The search prefers these within 5 km; bus stops are searched within 1.5 km when none are returned.',
  'A search with no results does not establish that a city has no railway. OSM coverage and geocoder matching both require review.',
  'Map data is current lookup data, not guaranteed to describe the travel dates.', '',
  'Source: [Photon](https://photon.komoot.io/) and [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).',
  'The Photon query returns at most 10 indexed nearby objects; nearest means nearest returned candidate, not a completeness guarantee.',
  'Private address-match links below identify geocoded buildings. Keep this report local.', '',
  '| Accommodation ID | City | Type | Status | Station candidate | Kind | Approx. distance | Station | Private address match |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...results.map(row => `| ${[row.accommodationId, row.city, row.type, row.status, row.station?.name ?? row.airportCode, row.station?.type, row.station?.distanceMetres != null ? `${row.station.distanceMetres} m` : '-', row.station?.sourceUrl ? `[OSM](${row.station.sourceUrl})` : '-', row.geocodeSourceUrl ? `[Check building](${row.geocodeSourceUrl})` : '-'].map(clean).join(' | ')} |`),
  '', '## Pending owner corrections', '',
  ...Object.entries(owner.pending).map(([id, value]) => `- ${clean(id)}: ${clean(value.stationName)} — ${clean(value.reason)}`),
  '', '## Review checklist', '',
  '- Confirm the private address matches the selected geocoder building (cached locally).',
  '- Confirm station type: railway, metro, tram, or bus.',
  '- Confirm the candidate is usable from the accommodation; rivers, restricted access and station entrances can change walking distance.',
  '- Unresolved addresses need corrected address input or owner-provided coordinates before a station can be inferred.',
  '- Airport overnight has no accommodation street address; its airport code is retained instead.', '',
];
await writeFile(resolve(folder, 'review.md'), lines.join('\n'), 'utf8');
await writeFile(resolve(folder, 'reviewed.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
console.log(`Created local review for ${results.length} Accommodation rows.`);
