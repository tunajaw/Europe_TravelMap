import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { readCsv } from '../preprocess/csv.ts';
import type { OsmNameTags } from './localized-name.ts';

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

type RecoveryPoi = Candidate & { cityId: string; recoveryId: string; sourceKey: string };

const root = resolve(import.meta.dirname, '..', '..');
const input = resolve(root, 'data', 'generated', 'poi-review', 'review-data.json');
const output = resolve(root, 'data', 'parsed', 'poi_reference.json');
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

const pois = [...candidatesBySource.values()]
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
      review_status: 'provisional_owner_assumption',
    };
  })
  .sort((left, right) => left.city_id.localeCompare(right.city_id) || left.name.localeCompare(right.name));

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(pois, null, 2)}\n`, 'utf8');
process.stdout.write(`Exported ${pois.length} provisional City Map POIs to ${output}\n`);
process.stdout.write(`Included separate English/source and Chinese names for ${bilingualCount} POIs.\n`);
