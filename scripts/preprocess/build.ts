import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildDataset } from './dataset.ts';

const root = resolve(import.meta.dirname, '..', '..');
const output = resolve(root, 'public', 'data', 'travel-data.json');
const data = await buildDataset(root);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(
  `Built ${output}: ${data.trips.length} Trips, ${data.segments.length} Segments, `
  + `${data.transfers.length} Transfers, ${data.accommodations.length} Accommodations, `
  + `${data.photos.length} Photos.`,
);
