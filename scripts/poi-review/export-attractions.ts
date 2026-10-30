import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { readCsv } from '../preprocess/csv.ts';
import { haversineKm } from '../preprocess/geo.ts';
import type { OsmNameTags } from './localized-name.ts';
import {
  applyGooglePlaceCoordinateOverride,
  mergeManualPoiReferences,
  manualPoiNameHash,
  prunePublicPoiReferences,
  type GooglePlaceCoordinateOverride,
  type ManualPoiReference,
  type PublicPoiReference,
} from './manual-pois.ts';

type Candidate = {
  osmId: string;
  osmUrl: string;
  name: string;
  category: 'Attraction' | 'Unclassified';
  subcategory: string;
  latitude: number;
  longitude: number;
  tags?: OsmNameTags;
};

type ExportCandidate = Candidate & {
  cityId: string;
  recoveryId?: string;
  nameSource: 'osm' | 'google';
};

type ReviewPoi = {
  cityId: string;
  reviewStatus: string;
  category: string;
  selectedCandidate: number | string;
  candidates: Candidate[];
};

type RecoveryPoi = Candidate & {
  cityId: string;
  recoveryId: string;
  sourceKey: string;
  googlePlaceId?: string;
  matchedOsmCategory?: string;
};

const root = resolve(import.meta.dirname, '..', '..');
const input = resolve(root, 'data', 'generated', 'poi-review', 'review-data.json');
const output = resolve(root, 'data', 'parsed', 'poi_reference.json');
const manualInput = resolve(root, 'data', 'parsed', 'manual_poi_reference.json');
const googlePlaceCoordinateOverridesInput = resolve(
  root,
  'data',
  'parsed',
  'poi_google_place_coordinate_overrides.json',
);
const reviewedRetentionInput = resolve(root, 'data', 'parsed', 'reviewed_poi_retention.json');
const reviewedIdsInput = resolve(root, 'data', 'parsed', 'poi_reviewed_ids.json');
const reviewedNameHashesInput = resolve(root, 'data', 'parsed', 'poi_reviewed_name_hashes.json');
const reviewedCoordinateLocksInput = resolve(root, 'data', 'parsed', 'poi_reviewed_coordinate_locks.json');
const reviewedSnapshotsInput = resolve(root, 'data', 'parsed', 'poi_reviewed_snapshots.json');
const discardedSnapshotsInput = resolve(root, 'data', 'parsed', 'poi_discarded_snapshots.json');
const recheckSnapshotsInput = resolve(root, 'data', 'parsed', 'poi_coordinate_recheck_snapshots.json');
const coordinateAuditOutput = resolve(root, 'data', 'private', 'poi-review', 'coordinate-audit.json');
const osmCache = resolve(root, 'data', 'generated', 'poi-review', 'osm-cache');
const privateAccommodationSource = resolve(root, 'data', 'private', 'accommodation-raw.csv');
const review = JSON.parse(await readFile(input, 'utf8')) as {
  pois: ReviewPoi[];
  searchedPoiRecovery: RecoveryPoi[];
};
const googlePlaceCoordinateOverrideRows = JSON.parse(
  await readFile(googlePlaceCoordinateOverridesInput, 'utf8'),
) as GooglePlaceCoordinateOverride[];
const googlePlaceCoordinateOverrides = new Map(
  googlePlaceCoordinateOverrideRows.map((row) => [row.google_place_id, row]),
);
if (googlePlaceCoordinateOverrides.size !== googlePlaceCoordinateOverrideRows.length) {
  throw new Error('Duplicate Google Place coordinate override identity');
}
for (const row of googlePlaceCoordinateOverrideRows) {
  if (!row.google_place_id || !row.city_id || !row.name
    || !Number.isFinite(row.latitude) || Math.abs(row.latitude) > 90
    || !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180
    || row.source_status !== 'owner_confirmed_google_maps_link') {
    throw new Error(`Invalid Google Place coordinate override: ${row.google_place_id}`);
  }
}
const privateAccommodationRows = await readCsv<{
  '住宿地址': string;
  '名稱(如有)': string;
}>(privateAccommodationSource);
const privateAccommodationValues = privateAccommodationRows.flatMap((row) => [
  row['住宿地址'].trim(),
  row['名稱(如有)'].trim(),
]).filter(Boolean);
const exposesPrivateAccommodation = (name: string): boolean =>
  privateAccommodationValues.some((privateValue) => name.includes(privateValue));

const candidatesBySource = new Map<string, ExportCandidate>();
for (const poi of review.pois) {
  if (poi.reviewStatus !== 'auto_approved' || poi.category !== 'Attraction'
    || typeof poi.selectedCandidate !== 'number') continue;
  const candidate = poi.candidates[poi.selectedCandidate - 1];
  if (candidate?.category === 'Attraction') {
    candidatesBySource.set(`osm:${candidate.osmId}`, { ...candidate, cityId: poi.cityId, nameSource: 'osm' });
  }
}
let googlePlaceCoordinateOverrideCount = 0;
for (const rawCandidate of review.searchedPoiRecovery) {
  const coordinateOverride = rawCandidate.googlePlaceId
    ? googlePlaceCoordinateOverrides.get(rawCandidate.googlePlaceId)
    : undefined;
  if (coordinateOverride && coordinateOverride.city_id !== rawCandidate.cityId) {
    throw new Error(`Google Place coordinate override City mismatch: ${rawCandidate.googlePlaceId}`);
  }
  const candidate = applyGooglePlaceCoordinateOverride(
    rawCandidate,
    googlePlaceCoordinateOverrides,
  );
  if (candidate.latitude !== rawCandidate.latitude
    || candidate.longitude !== rawCandidate.longitude) {
    googlePlaceCoordinateOverrideCount += 1;
  }
  const sourceKey = candidate.osmId && candidate.category === 'Attraction'
    ? `osm:${candidate.osmId}`
    : `recovery:${candidate.sourceKey}`;
  candidatesBySource.set(sourceKey, { ...candidate, nameSource: 'google' });
}

type CachedFeature = { osmId?: string; tags?: OsmNameTags };
const cachedTags = new Map<string, OsmNameTags>();
for (const filename of await readdir(osmCache)) {
  if (!filename.endsWith('.json') || /-\d+\.json$/.test(filename)) continue;
  const cached = JSON.parse(await readFile(join(osmCache, filename), 'utf8')) as { features?: CachedFeature[] };
  for (const feature of cached.features ?? []) {
    if (feature.osmId && feature.tags) cachedTags.set(feature.osmId, feature.tags);
  }
}

let bilingualCount = 0;

const provisionalPois = [...candidatesBySource.values()]
  .filter((candidate) => !exposesPrivateAccommodation(candidate.name))
  .map((candidate) => {
    const tags = candidate.tags ?? cachedTags.get(candidate.osmId) ?? {};
    const englishName = candidate.nameSource === 'google'
      ? candidate.name
      : tags['name:en']?.trim() || candidate.name;
    const chineseName = tags['name:zh-Hant']?.trim() || tags['name:zh']?.trim() || null;
    if (chineseName && chineseName !== englishName) bilingualCount += 1;
    const sourceId = candidate.osmId
      ? candidate.osmId.replace('/', '-')
      : candidate.recoveryId ?? candidate.name;
    return {
      poi_id: `${candidate.category.toLowerCase()}-${sourceId}`,
      city_id: candidate.cityId,
      name: englishName,
      localized_name: chineseName && chineseName !== englishName ? chineseName : null,
      original_name: candidate.name,
      category: candidate.category,
      subcategory: candidate.subcategory,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      source_osm_id: candidate.osmId || undefined,
      source_osm_url: candidate.osmUrl || undefined,
      source_matched_category: 'matchedOsmCategory' in candidate ? candidate.matchedOsmCategory : undefined,
      review_status: 'provisional_owner_assumption',
    };
  })
  .sort((left, right) => left.city_id.localeCompare(right.city_id) || left.name.localeCompare(right.name));

let pois: PublicPoiReference[] = provisionalPois;
let reviewedNameHashes = new Map<string, ReadonlySet<string>>();
try {
  const rows = JSON.parse(await readFile(reviewedNameHashesInput, 'utf8')) as Array<{
    poi_id: string;
    name_hashes: string[];
  }>;
  reviewedNameHashes = new Map(rows.map((row) => [row.poi_id, new Set(row.name_hashes)]));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
let acceptedReviewedIds = new Set<string>();
try {
  const reviewedSnapshots = JSON.parse(await readFile(reviewedSnapshotsInput, 'utf8')) as PublicPoiReference[];
  acceptedReviewedIds = new Set(reviewedSnapshots.map(({ poi_id }) => poi_id));
  for (const snapshot of reviewedSnapshots) {
    const existingIndex = pois.findIndex((poi) => poi.poi_id === snapshot.poi_id);
    if (existingIndex >= 0) pois[existingIndex] = snapshot;
    else pois.push(snapshot);
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const retained = JSON.parse(await readFile(reviewedRetentionInput, 'utf8')) as Array<
  PublicPoiReference & { replaces_poi_id?: string }
>;
for (const reviewedPoi of retained) {
  const existingReviewedIndex = pois.findIndex((poi) => poi.poi_id === reviewedPoi.poi_id);
  const replacementIndex = existingReviewedIndex >= 0
    ? existingReviewedIndex
    : pois.findIndex((poi) => poi.poi_id === reviewedPoi.replaces_poi_id);
  const { replaces_poi_id: _, ...publicReviewedPoi } = reviewedPoi;
  if (replacementIndex >= 0) pois[replacementIndex] = publicReviewedPoi;
  else pois.push(publicReviewedPoi);
}
const hashesForPoi = (poi: PublicPoiReference): Set<string> => new Set([
  poi.name,
  poi.localized_name,
  poi.original_name,
].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
  .map(manualPoiNameHash));
const matchingPoiIndex = (snapshot: PublicPoiReference): number => {
  const directIndex = pois.findIndex(({ poi_id }) => poi_id === snapshot.poi_id);
  if (directIndex >= 0) return directIndex;
  const expectedHashes = reviewedNameHashes.get(snapshot.poi_id) ?? hashesForPoi(snapshot);
  const candidates = pois.map((poi, index) => ({ poi, index }))
    .filter(({ poi }) => poi.city_id === snapshot.city_id
      && !acceptedReviewedIds.has(poi.poi_id)
      && [...hashesForPoi(poi)].some((hash) => expectedHashes.has(hash)))
    .sort((left, right) => haversineKm(snapshot, left.poi) - haversineKm(snapshot, right.poi));
  return candidates[0]?.index ?? -1;
};
let discardedCount = 0;
try {
  const discardedSnapshots = JSON.parse(
    await readFile(discardedSnapshotsInput, 'utf8'),
  ) as PublicPoiReference[];
  for (const snapshot of discardedSnapshots) {
    const index = matchingPoiIndex(snapshot);
    if (index >= 0) {
      pois.splice(index, 1);
      discardedCount += 1;
    }
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const coordinateRecheckIds = new Set<string>();
try {
  const recheckSnapshots = JSON.parse(
    await readFile(recheckSnapshotsInput, 'utf8'),
  ) as PublicPoiReference[];
  for (const snapshot of recheckSnapshots) {
    const index = matchingPoiIndex(snapshot);
    const recheckId = `${snapshot.poi_id}-coordinate-review`;
    if (index >= 0) {
      pois[index] = {
        ...pois[index]!,
        poi_id: recheckId,
        name: snapshot.name,
        localized_name: snapshot.localized_name,
        review_status: 'needs_review',
      };
    }
    else pois.push({ ...snapshot, poi_id: recheckId, review_status: 'needs_review' });
    coordinateRecheckIds.add(recheckId);
    const aliases = reviewedNameHashes.get(snapshot.poi_id);
    if (aliases) reviewedNameHashes.set(recheckId, aliases);
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const reviewedCoordinateFindings: Array<{
  poi_id: string;
  city_id: string;
  name: string;
  proposed_latitude: number;
  proposed_longitude: number;
  locked_latitude: number;
  locked_longitude: number;
  distance_meters: number;
}> = [];
try {
  const locks = JSON.parse(await readFile(reviewedCoordinateLocksInput, 'utf8')) as Array<{
    poi_id: string;
    latitude: number;
    longitude: number;
  }>;
  for (const lock of locks) {
    const poi = pois.find((candidate) => candidate.poi_id === lock.poi_id);
    if (!poi) continue;
    const distanceMeters = Math.round(haversineKm(
      { latitude: poi.latitude, longitude: poi.longitude },
      { latitude: lock.latitude, longitude: lock.longitude },
    ) * 1_000);
    if (distanceMeters >= 250) {
      reviewedCoordinateFindings.push({
        poi_id: poi.poi_id,
        city_id: poi.city_id,
        name: poi.name,
        proposed_latitude: poi.latitude,
        proposed_longitude: poi.longitude,
        locked_latitude: lock.latitude,
        locked_longitude: lock.longitude,
        distance_meters: distanceMeters,
      });
    }
    poi.latitude = lock.latitude;
    poi.longitude = lock.longitude;
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
let manualAdded = 0;
let manualUpdated = 0;
let manualDeduplicated = 0;
let manuallyUpdatedPoiIds = new Set<string>();
try {
  const manual = JSON.parse(await readFile(manualInput, 'utf8')) as ManualPoiReference[];
  const merged = mergeManualPoiReferences(pois, manual, reviewedNameHashes);
  pois = merged.pois;
  manualAdded = merged.added;
  manualUpdated = merged.updated;
  manualDeduplicated = merged.deduplicated;
  manuallyUpdatedPoiIds = new Set(merged.updatedPoiIds);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const coordinateAudit = reviewedCoordinateFindings
  .filter((finding) => !manuallyUpdatedPoiIds.has(finding.poi_id))
  .sort((left, right) => right.distance_meters - left.distance_meters
    || left.city_id.localeCompare(right.city_id)
    || left.name.localeCompare(right.name));
await mkdir(dirname(coordinateAuditOutput), { recursive: true });
await writeFile(coordinateAuditOutput, `${JSON.stringify(coordinateAudit, null, 2)}\n`, 'utf8');

let reviewedPoiIds = new Set<string>();
try {
  reviewedPoiIds = new Set(JSON.parse(await readFile(reviewedIdsInput, 'utf8')) as string[]);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const pruned = prunePublicPoiReferences(
  pois,
  15,
  new Set([...reviewedPoiIds, ...coordinateRecheckIds]),
);
pois = pruned.pois.map((poi) => {
  const { source_matched_category: _, ...publicPoi } = poi;
  return publicPoi;
});

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(pois, null, 2)}\n`, 'utf8');
process.stdout.write(`Exported ${pois.length} provisional City Map POIs to ${output}\n`);
process.stdout.write(`Included separate English/source and Chinese names for ${bilingualCount} POIs.\n`);
process.stdout.write(`Manual owner-confirmed POIs: ${manualAdded} added, ${manualUpdated} matched and updated.\n`);
process.stdout.write(`Manual location-update duplicates collapsed: ${manualDeduplicated}.\n`);
process.stdout.write(`Owner-confirmed Google Place coordinate overrides: ${googlePlaceCoordinateOverrideCount}.\n`);
process.stdout.write(`Reviewed coordinate changes held for audit: ${coordinateAudit.length}.\n`);
process.stdout.write(`Discarded reviewed POIs excluded: ${discardedCount}.\n`);
process.stdout.write(`Coordinate rechecks reopened: ${coordinateRecheckIds.size}.\n`);
process.stdout.write(`Review-list pruning: ${pruned.retailRemoved} retail POIs and ${pruned.denseRemoved} dense duplicates removed.\n`);
