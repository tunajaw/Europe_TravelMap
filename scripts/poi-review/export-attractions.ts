import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { readCsv } from '../preprocess/csv.ts';
import type { OsmNameTags } from './localized-name.ts';
import {
  mergeManualPoiReferences,
  prunePublicPoiReferences,
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
  matchedOsmCategory?: string;
};

const root = resolve(import.meta.dirname, '..', '..');
const input = resolve(root, 'data', 'generated', 'poi-review', 'review-data.json');
const output = resolve(root, 'data', 'parsed', 'poi_reference.json');
const manualInput = resolve(root, 'data', 'parsed', 'manual_poi_reference.json');
const reviewedRetentionInput = resolve(root, 'data', 'parsed', 'reviewed_poi_retention.json');
const reviewedIdsInput = resolve(root, 'data', 'parsed', 'poi_reviewed_ids.json');
const reviewedNameHashesInput = resolve(root, 'data', 'parsed', 'poi_reviewed_name_hashes.json');
const osmCache = resolve(root, 'data', 'generated', 'poi-review', 'osm-cache');
const privateAccommodationSource = resolve(root, 'data', 'private', 'accommodation-raw.csv');
const review = JSON.parse(await readFile(input, 'utf8')) as {
  pois: ReviewPoi[];
  searchedPoiRecovery: RecoveryPoi[];
};
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
for (const candidate of review.searchedPoiRecovery) {
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
    const englishName = tags['name:en']?.trim() || candidate.name;
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
const retained = JSON.parse(await readFile(reviewedRetentionInput, 'utf8')) as Array<
  PublicPoiReference & { replaces_poi_id?: string }
>;
for (const reviewedPoi of retained) {
  const replacementIndex = pois.findIndex((poi) => poi.poi_id === reviewedPoi.poi_id
    || poi.poi_id === reviewedPoi.replaces_poi_id);
  const { replaces_poi_id: _, ...publicReviewedPoi } = reviewedPoi;
  if (replacementIndex >= 0) pois[replacementIndex] = publicReviewedPoi;
  else pois.push(publicReviewedPoi);
}
let manualAdded = 0;
let manualUpdated = 0;
let manualDeduplicated = 0;
try {
  const manual = JSON.parse(await readFile(manualInput, 'utf8')) as ManualPoiReference[];
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
  const merged = mergeManualPoiReferences(pois, manual, reviewedNameHashes);
  pois = merged.pois;
  manualAdded = merged.added;
  manualUpdated = merged.updated;
  manualDeduplicated = merged.deduplicated;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

let reviewedPoiIds = new Set<string>();
try {
  reviewedPoiIds = new Set(JSON.parse(await readFile(reviewedIdsInput, 'utf8')) as string[]);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const pruned = prunePublicPoiReferences(
  pois,
  15,
  reviewedPoiIds,
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
process.stdout.write(`Review-list pruning: ${pruned.retailRemoved} retail POIs and ${pruned.denseRemoved} dense duplicates removed.\n`);
