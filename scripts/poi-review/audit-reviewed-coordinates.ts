import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { haversineKm } from '../preprocess/geo.ts';
import { normalizePoiName, osmFeatureNames, type OsmFeature } from './model.ts';

const reviewInputArgument = process.argv[2];
if (!reviewInputArgument) {
  throw new Error('Usage: npm run data:poi-coordinate-audit -- <poi-review-results.json>');
}

const root = resolve(import.meta.dirname, '..', '..');
const reviewInput = resolve(reviewInputArgument);
const snapshotsInput = resolve(root, 'data', 'parsed', 'poi_reviewed_snapshots.json');
const osmCache = resolve(root, 'data', 'generated', 'poi-review', 'osm-cache');
const output = resolve(root, 'data', 'private', 'poi-review', 'reviewed-coordinate-audit.json');

const review = JSON.parse(await readFile(reviewInput, 'utf8')) as {
  reviews: Array<{
    poiId: string;
    editedName?: string | null;
    editedLocalizedName?: string | null;
    decision: 'Keep' | 'Discard';
    reviewStatus: string;
  }>;
};
const snapshots = JSON.parse(await readFile(snapshotsInput, 'utf8')) as Array<{
  poi_id: string;
  city_id: string;
  name: string;
  localized_name?: string | null;
  original_name?: string | null;
  latitude: number;
  longitude: number;
}>;
const reviewById = new Map(review.reviews
  .filter(({ reviewStatus }) => reviewStatus === 'reviewed')
  .map((row) => [row.poiId, row]));

const featuresByCity = new Map<string, OsmFeature[]>();
for (const filename of await readdir(osmCache)) {
  if (!filename.endsWith('.json') || /-\d+\.json$/.test(filename)) continue;
  const payload = JSON.parse(await readFile(join(osmCache, filename), 'utf8')) as {
    features?: OsmFeature[];
  };
  if (!payload.features) continue;
  featuresByCity.set(filename.replace(/\.json$/, ''), payload.features);
}

const findings = snapshots.flatMap((snapshot) => {
  const reviewed = reviewById.get(snapshot.poi_id);
  if (!reviewed) return [];
  const names = new Set([
    snapshot.name,
    snapshot.localized_name,
    snapshot.original_name,
    reviewed.editedName,
    reviewed.editedLocalizedName,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map(normalizePoiName));
  const exactMatches = (featuresByCity.get(snapshot.city_id) ?? []).filter((feature) =>
    osmFeatureNames(feature).some((alias) => names.has(normalizePoiName(alias))));
  const uniqueMatches = [...new Map(exactMatches.map((feature) => [feature.osmId, feature])).values()];
  if (uniqueMatches.length !== 1) return [];
  const candidate = uniqueMatches[0]!;
  const distanceMeters = Math.round(haversineKm(snapshot, candidate) * 1_000);
  if (distanceMeters < 250) return [];
  return [{
    poi_id: snapshot.poi_id,
    city_id: snapshot.city_id,
    name: reviewed.editedName || snapshot.name,
    locked_latitude: snapshot.latitude,
    locked_longitude: snapshot.longitude,
    candidate_latitude: candidate.latitude,
    candidate_longitude: candidate.longitude,
    candidate_osm_id: candidate.osmId,
    distance_meters: distanceMeters,
    decision: reviewed.decision,
    action: 'report_only_do_not_modify',
  }];
}).sort((left, right) => right.distance_meters - left.distance_meters
  || left.city_id.localeCompare(right.city_id)
  || left.name.localeCompare(right.name));

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(findings, null, 2)}\n`, 'utf8');
process.stdout.write(`Reported ${findings.length} reviewed POI coordinate candidates to ${output}\n`);
