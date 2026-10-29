import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { manualPoiNameHash } from './manual-pois.ts';

const inputArgument = process.argv[2];
if (!inputArgument) throw new Error('Usage: npm run data:poi-review-protection -- <poi-review-results.json>');

const root = resolve(import.meta.dirname, '..', '..');
const input = resolve(inputArgument);
const output = resolve(root, 'data', 'parsed', 'poi_reviewed_ids.json');
const aliasesOutput = resolve(root, 'data', 'parsed', 'poi_reviewed_name_hashes.json');
const parsed = JSON.parse(await readFile(input, 'utf8')) as {
  schemaVersion?: unknown;
  reviews?: Array<{
    poiId?: unknown;
    decision?: unknown;
    reviewStatus?: unknown;
    categories?: unknown;
    editedName?: unknown;
    editedLocalizedName?: unknown;
  }>;
};
if (![1, 2].includes(parsed.schemaVersion as number) || !Array.isArray(parsed.reviews)) {
  throw new Error('Unsupported POI review result');
}
const reviewedIds = parsed.reviews.flatMap((row) =>
  row.reviewStatus === 'reviewed' && typeof row.poiId === 'string'
    ? [row.poiId]
    : []
).sort();
const reviewedNameHashes = parsed.reviews.flatMap((row) => {
  if (row.reviewStatus !== 'reviewed' || typeof row.poiId !== 'string') return [];
  const hashes = [row.editedName, row.editedLocalizedName]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map(manualPoiNameHash);
  return hashes.length ? [{ poi_id: row.poiId, name_hashes: [...new Set(hashes)].sort() }] : [];
}).sort((left, right) => left.poi_id.localeCompare(right.poi_id));
if (new Set(reviewedIds).size !== reviewedIds.length) throw new Error('Duplicate reviewed POI ID');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(reviewedIds, null, 2)}\n`, 'utf8');
await writeFile(aliasesOutput, `${JSON.stringify(reviewedNameHashes, null, 2)}\n`, 'utf8');
process.stdout.write(`Wrote ${reviewedIds.length} reviewed POI IDs to ${output}\n`);
process.stdout.write(`Wrote ${reviewedNameHashes.length} hashed reviewed-name aliases to ${aliasesOutput}\n`);
