import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { manualPoiNameHash } from './manual-pois.ts';
import { assignVaticanBoundaryPoisToRome, type PoiBoundary } from './city-assignment.ts';

const inputArgument = process.argv[2];
if (!inputArgument) throw new Error('Usage: npm run data:poi-review-protection -- <poi-review-results.json>');

const root = resolve(import.meta.dirname, '..', '..');
const input = resolve(inputArgument);
const output = resolve(root, 'data', 'parsed', 'poi_reviewed_ids.json');
const aliasesOutput = resolve(root, 'data', 'parsed', 'poi_reviewed_name_hashes.json');
const categoriesOutput = resolve(root, 'data', 'parsed', 'poi_reviewed_categories.json');
const coordinateLocksOutput = resolve(root, 'data', 'parsed', 'poi_reviewed_coordinate_locks.json');
const snapshotsOutput = resolve(root, 'data', 'parsed', 'poi_reviewed_snapshots.json');
const discardedIdsOutput = resolve(root, 'data', 'parsed', 'poi_discarded_ids.json');
const discardedSnapshotsOutput = resolve(root, 'data', 'parsed', 'poi_discarded_snapshots.json');
const recheckIdsOutput = resolve(root, 'data', 'parsed', 'poi_coordinate_recheck_ids.json');
const recheckSnapshotsOutput = resolve(root, 'data', 'parsed', 'poi_coordinate_recheck_snapshots.json');
const coordinateAuditInput = resolve(root, 'data', 'private', 'poi-review', 'reviewed-coordinate-audit.json');
const poiInput = resolve(root, 'data', 'parsed', 'poi_reference.json');
const cityContextInput = resolve(root, 'data', 'parsed', 'city_map_context.json');
const baselineRefIndex = process.argv.indexOf('--baseline-git-ref');
const baselineGitRef = baselineRefIndex >= 0 ? process.argv[baselineRefIndex + 1] : undefined;
const parsed = JSON.parse(await readFile(input, 'utf8')) as {
  schemaVersion?: unknown;
  reviews?: Array<{
    poiId?: unknown;
    decision?: unknown;
    reviewStatus?: unknown;
    editedName?: unknown;
    editedLocalizedName?: unknown;
    categories?: unknown;
  }>;
};
if (![1, 2].includes(parsed.schemaVersion as number) || !Array.isArray(parsed.reviews)) {
  throw new Error('Unsupported POI review result');
}
const reviewedRows = parsed.reviews.filter((row) => row.reviewStatus === 'reviewed'
  && typeof row.poiId === 'string'
  && (row.decision === 'Keep' || row.decision === 'Discard')) as Array<{
    poiId: string;
    decision: 'Keep' | 'Discard';
    editedName?: unknown;
    editedLocalizedName?: unknown;
    categories?: unknown;
  }>;
const allReviewedIds = reviewedRows.map(({ poiId }) => poiId).sort();
const reviewedRowById = new Map(reviewedRows.map((row) => [row.poiId, row]));
let coordinateAudit: Array<{ poi_id: string; decision: 'Keep' | 'Discard' }> = [];
try {
  coordinateAudit = JSON.parse(await readFile(coordinateAuditInput, 'utf8')) as typeof coordinateAudit;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const recheckIds = coordinateAudit
  .filter(({ decision }) => decision === 'Keep')
  .map(({ poi_id }) => poi_id)
  .sort();
const recheckIdSet = new Set(recheckIds);
const discardedIds = reviewedRows
  .filter(({ decision }) => decision === 'Discard')
  .map(({ poiId }) => poiId)
  .sort();
const reviewedIds = reviewedRows
  .filter(({ decision, poiId }) => decision === 'Keep' && !recheckIdSet.has(poiId))
  .map(({ poiId }) => poiId)
  .sort();
const reviewedNameHashes = parsed.reviews.flatMap((row) => {
  if (row.reviewStatus !== 'reviewed' || typeof row.poiId !== 'string') return [];
  const hashes = [row.editedName, row.editedLocalizedName]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map(manualPoiNameHash);
  return hashes.length ? [{ poi_id: row.poiId, name_hashes: [...new Set(hashes)].sort() }] : [];
}).sort((left, right) => left.poi_id.localeCompare(right.poi_id));
const reviewedCategories = reviewedRows.flatMap((row) => {
  if (row.decision !== 'Keep' || recheckIdSet.has(row.poiId)) return [];
  if (!Array.isArray(row.categories) || row.categories.length !== 1) {
    throw new Error(`Kept POI must have exactly one reviewed category: ${row.poiId}`);
  }
  const sourceCategory = row.categories[0];
  const category = sourceCategory === 'Attractions' ? 'Attraction' : sourceCategory;
  if (!['Attraction', 'Shop', 'Restaurant', 'Accommodation', 'Transportation'].includes(category as string)) {
    throw new Error(`Unsupported reviewed POI category: ${row.poiId}`);
  }
  return [{ poi_id: row.poiId, category }];
}).sort((left, right) => left.poi_id.localeCompare(right.poi_id));
type PoiSnapshot = {
  poi_id: string;
  city_id: string;
  name: string;
  localized_name: string | null;
  latitude: number;
  longitude: number;
  [key: string]: unknown;
};
const currentPois = JSON.parse(await readFile(poiInput, 'utf8')) as PoiSnapshot[];
let existingSnapshots: PoiSnapshot[] = [];
try {
  existingSnapshots = JSON.parse(await readFile(snapshotsOutput, 'utf8')) as PoiSnapshot[];
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
let existingDiscardedSnapshots: PoiSnapshot[] = [];
try {
  existingDiscardedSnapshots = JSON.parse(
    await readFile(discardedSnapshotsOutput, 'utf8'),
  ) as PoiSnapshot[];
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
let existingRecheckSnapshots: PoiSnapshot[] = [];
try {
  existingRecheckSnapshots = JSON.parse(
    await readFile(recheckSnapshotsOutput, 'utf8'),
  ) as PoiSnapshot[];
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const baselinePois = baselineGitRef
  ? JSON.parse(execFileSync(
    'git',
    ['show', `${baselineGitRef}:data/parsed/poi_reference.json`],
    { cwd: root, encoding: 'utf8' },
  )) as PoiSnapshot[]
  : [];
const allReviewedIdSet = new Set(allReviewedIds);
const snapshotCandidates = new Map<string, PoiSnapshot>();
for (const poi of [
  ...existingSnapshots,
  ...existingDiscardedSnapshots,
  ...existingRecheckSnapshots,
  ...baselinePois,
  ...currentPois,
]) {
  if (allReviewedIdSet.has(poi.poi_id)) snapshotCandidates.set(poi.poi_id, poi);
}
let allSnapshots = allReviewedIds.flatMap((poiId) => {
  const snapshot = snapshotCandidates.get(poiId);
  if (!snapshot) return [];
  const reviewed = reviewedRowById.get(poiId)!;
  if (reviewed.decision !== 'Keep') return [snapshot];
  return [{
    ...snapshot,
    name: typeof reviewed.editedName === 'string' && reviewed.editedName.trim()
      ? reviewed.editedName.trim()
      : snapshot.name,
    localized_name: typeof reviewed.editedLocalizedName === 'string'
      && reviewed.editedLocalizedName.trim()
      ? reviewed.editedLocalizedName.trim()
      : snapshot.localized_name,
  }];
});
const cityContexts = JSON.parse(await readFile(cityContextInput, 'utf8')) as Array<{
  city_id: string;
  boundary: PoiBoundary;
}>;
const vaticanBoundary = cityContexts.find(({ city_id: cityId }) => cityId === 'city-vatican-city')?.boundary;
if (!vaticanBoundary) throw new Error('Missing Vatican City administrative boundary');
allSnapshots = assignVaticanBoundaryPoisToRome(allSnapshots, vaticanBoundary);
const allSnapshotById = new Map(allSnapshots.map((snapshot) => [snapshot.poi_id, snapshot]));
const reviewedSnapshots = reviewedIds.flatMap((poiId) => {
  const snapshot = allSnapshotById.get(poiId);
  return snapshot ? [snapshot] : [];
});
const discardedSnapshots = discardedIds.flatMap((poiId) => {
  const snapshot = allSnapshotById.get(poiId);
  return snapshot ? [snapshot] : [];
});
const recheckSnapshots = recheckIds.flatMap((poiId) => {
  const snapshot = allSnapshotById.get(poiId);
  return snapshot ? [snapshot] : [];
});
const coordinateLocks = reviewedSnapshots
  .map((poi) => ({ poi_id: poi.poi_id, latitude: poi.latitude, longitude: poi.longitude }))
  .sort((left, right) => left.poi_id.localeCompare(right.poi_id));
if (new Set(allReviewedIds).size !== allReviewedIds.length) throw new Error('Duplicate reviewed POI ID');
const requiredSnapshotIds = [...reviewedIds, ...recheckIds];
const missingRequiredSnapshots = requiredSnapshotIds.filter((poiId) => !allSnapshotById.has(poiId));
if (missingRequiredSnapshots.length > 0) {
  throw new Error(`Missing snapshots for ${missingRequiredSnapshots.length} kept POIs`);
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(reviewedIds, null, 2)}\n`, 'utf8');
await writeFile(aliasesOutput, `${JSON.stringify(reviewedNameHashes, null, 2)}\n`, 'utf8');
await writeFile(categoriesOutput, `${JSON.stringify(reviewedCategories, null, 2)}\n`, 'utf8');
await writeFile(coordinateLocksOutput, `${JSON.stringify(coordinateLocks, null, 2)}\n`, 'utf8');
await writeFile(snapshotsOutput, `${JSON.stringify(reviewedSnapshots, null, 2)}\n`, 'utf8');
await writeFile(discardedIdsOutput, `${JSON.stringify(discardedIds, null, 2)}\n`, 'utf8');
await writeFile(discardedSnapshotsOutput, `${JSON.stringify(discardedSnapshots, null, 2)}\n`, 'utf8');
await writeFile(recheckIdsOutput, `${JSON.stringify(recheckIds, null, 2)}\n`, 'utf8');
await writeFile(recheckSnapshotsOutput, `${JSON.stringify(recheckSnapshots, null, 2)}\n`, 'utf8');
process.stdout.write(`Wrote ${reviewedIds.length} reviewed POI IDs to ${output}\n`);
process.stdout.write(`Wrote ${reviewedNameHashes.length} hashed reviewed-name aliases to ${aliasesOutput}\n`);
process.stdout.write(`Wrote ${reviewedCategories.length} reviewed POI categories to ${categoriesOutput}\n`);
process.stdout.write(`Wrote ${coordinateLocks.length} reviewed coordinate locks to ${coordinateLocksOutput}\n`);
process.stdout.write(`Wrote ${reviewedSnapshots.length} reviewed POI snapshots to ${snapshotsOutput}\n`);
process.stdout.write(`Wrote ${discardedIds.length} discarded POI exclusions to ${discardedIdsOutput}\n`);
process.stdout.write(`Wrote ${recheckIds.length} coordinate recheck POIs to ${recheckIdsOutput}\n`);
