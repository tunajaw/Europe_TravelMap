import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TravelDataSchema, assertReferentialIntegrity } from '../../src/domain/travel-data.ts';

const root = resolve(import.meta.dirname, '..', '..');
const input = resolve(root, 'public', 'data', 'travel-data.json');
const data = TravelDataSchema.parse(JSON.parse(await readFile(input, 'utf8')));
assertReferentialIntegrity(data);

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
