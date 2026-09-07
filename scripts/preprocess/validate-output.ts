import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadReferences } from './references.ts';
import { TravelDataSchema, assertReferentialIntegrity } from '../../src/domain/travel-data.ts';

const root = resolve(import.meta.dirname, '..', '..');
const input = resolve(root, 'public', 'data', 'travel-data.json');
const data = TravelDataSchema.parse(JSON.parse(await readFile(input, 'utf8')));
assertReferentialIntegrity(data);
const references = await loadReferences(root);

const outputLocalTransfers = new Map(
  data.transfers
    .filter(({ endpointKind }) => endpointKind === 'local')
    .map((transfer) => [transfer.id, transfer.localRoute]),
);
if (outputLocalTransfers.size !== references.index.localTransfers.size) {
  throw new Error('Public Local Transfer count does not match reviewed references');
}
for (const [id, route] of references.index.localTransfers) {
  const outputRoute = outputLocalTransfers.get(id);
  if (!outputRoute
    || outputRoute.start.name !== route.start.name
    || outputRoute.start.latitude !== route.start.latitude
    || outputRoute.start.longitude !== route.start.longitude
    || outputRoute.end.name !== route.end.name
    || outputRoute.end.latitude !== route.end.latitude
    || outputRoute.end.longitude !== route.end.longitude) {
    throw new Error(`Public Local Transfer route is stale: ${id}`);
  }
}

for (const photo of data.photos) {
  await access(resolve(root, 'public', ...photo.path.split('/')));
}

const serialized = JSON.stringify(data);
for (const forbidden of ['住宿地址', '名稱(如有)', 'candidate_label', 'geocode_query']) {
  if (serialized.includes(forbidden)) throw new Error(`Public data contains forbidden field: ${forbidden}`);
}

console.log(
  `Validated ${data.countries.length} Countries, ${data.cities.length} Cities, `
  + `${data.airports.length} Airports, ${data.segments.length} Segments, and ${data.photos.length} Photos.`,
);
