import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { haversineKm } from '../preprocess/geo.ts';
import {
  matchPoiName,
  normalizePoiName,
  osmFeatureNames,
  type OsmFeature,
  type PoiNameMatch,
} from './model.ts';

type Poi = {
  poi_id: string;
  city_id: string;
  name: string;
  localized_name?: string | null;
  original_name?: string | null;
  latitude: number;
  longitude: number;
  review_status: string;
  subcategory: string;
  source_osm_id?: string;
};

type Match = {
  feature: OsmFeature;
  match: PoiNameMatch;
  distanceMeters: number;
};

const root = resolve(import.meta.dirname, '..', '..');
const poiInput = resolve(root, 'data', 'parsed', 'poi_reference.json');
const reviewedIdsInput = resolve(root, 'data', 'parsed', 'poi_reviewed_ids.json');
const reviewDataInput = resolve(root, 'data', 'generated', 'poi-review', 'review-data.json');
const osmCache = resolve(root, 'data', 'generated', 'poi-review', 'osm-cache');
const output = resolve(root, 'data', 'private', 'poi-review', 'unreviewed-coordinate-audit.json');

const pois = JSON.parse(await readFile(poiInput, 'utf8')) as Poi[];
const reviewedIds = new Set(JSON.parse(await readFile(reviewedIdsInput, 'utf8')) as string[]);
const reviewData = JSON.parse(await readFile(reviewDataInput, 'utf8')) as {
  searchedPoiRecovery: Array<{ recoveryId: string; googlePlaceId?: string }>;
};
const googlePlaceIdByPoiId = new Map(reviewData.searchedPoiRecovery.map((row) => [
  `unclassified-${row.recoveryId}`,
  row.googlePlaceId ?? '',
]));
type FeatureIndex = {
  exact: Map<string, Set<OsmFeature>>;
  tokens: Map<string, Set<OsmFeature>>;
};
const featureIndexes = new Map<string, FeatureIndex>();
for (const filename of await readdir(osmCache)) {
  if (!filename.endsWith('.json') || /-\d+\.json$/.test(filename)) continue;
  const payload = JSON.parse(await readFile(join(osmCache, filename), 'utf8')) as {
    features?: OsmFeature[];
  };
  if (!payload.features) continue;
  const index: FeatureIndex = { exact: new Map(), tokens: new Map() };
  for (const feature of payload.features) {
    for (const alias of osmFeatureNames(feature)) {
      const normalized = normalizePoiName(alias);
      if (!normalized) continue;
      const exact = index.exact.get(normalized) ?? new Set<OsmFeature>();
      exact.add(feature);
      index.exact.set(normalized, exact);
      for (const token of new Set(normalized.split(' ').filter((value) => value.length >= 3))) {
        const matches = index.tokens.get(token) ?? new Set<OsmFeature>();
        matches.add(feature);
        index.tokens.set(token, matches);
      }
    }
  }
  featureIndexes.set(filename.replace(/\.json$/, ''), index);
}

const isAuditEligible = (poi: Poi): boolean => !reviewedIds.has(poi.poi_id)
  && poi.review_status !== 'needs_review'
  && poi.subcategory !== 'owner_confirmed_visit'
  && !poi.source_osm_id;
const eligiblePois = pois.filter(isAuditEligible);
const missingCityIds = [...new Set(eligiblePois
  .map(({ city_id }) => city_id)
  .filter((cityId) => !featureIndexes.has(cityId)))].sort();

const findings = pois.flatMap((poi) => {
  if (!isAuditEligible(poi)) return [];
  const names = [poi.name, poi.localized_name, poi.original_name]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  const featureIndex = featureIndexes.get(poi.city_id);
  if (!featureIndex) return [];
  const candidateCounts = new Map<OsmFeature, number>();
  const exactCandidates = new Set<OsmFeature>();
  for (const name of names) {
    const normalized = normalizePoiName(name);
    for (const feature of featureIndex.exact.get(normalized) ?? []) exactCandidates.add(feature);
    for (const token of new Set(normalized.split(' ').filter((value) => value.length >= 3))) {
      for (const feature of featureIndex.tokens.get(token) ?? []) {
        candidateCounts.set(feature, (candidateCounts.get(feature) ?? 0) + 1);
      }
    }
  }
  const candidateFeatures = new Set([
    ...exactCandidates,
    ...[...candidateCounts].filter(([, count]) => count >= 2).map(([feature]) => feature),
  ]);
  const matches = [...candidateFeatures].flatMap((feature): Match[] => {
    const best = names.reduce<PoiNameMatch | null>((current, name) => {
      const candidate = matchPoiName(name, feature);
      return candidate && (!current || candidate.score > current.score) ? candidate : current;
    }, null);
    return best && best.score >= 0.85
      ? [{ feature, match: best, distanceMeters: Math.round(haversineKm(poi, feature) * 1_000) }]
      : [];
  }).sort((left, right) => right.match.score - left.match.score
    || left.distanceMeters - right.distanceMeters);
  const best = matches[0];
  if (!best || best.distanceMeters < 250) return [];
  const sameScore = matches.filter(({ match }) => match.score === best.match.score);
  const confidence = best.match.score === 1 && sameScore.length === 1
    ? 'high'
    : best.match.score >= 0.92 && sameScore.length === 1
      ? 'medium'
      : 'ambiguous';
  return [{
    poi_id: poi.poi_id,
    city_id: poi.city_id,
    name: poi.name,
    current_latitude: poi.latitude,
    current_longitude: poi.longitude,
    candidate_latitude: best.feature.latitude,
    candidate_longitude: best.feature.longitude,
    candidate_osm_id: best.feature.osmId,
    candidate_osm_name: best.feature.name,
    candidate_osm_category: best.feature.category,
    candidate_osm_subcategory: best.feature.subcategory,
    google_place_id: googlePlaceIdByPoiId.get(poi.poi_id) || null,
    distance_meters: best.distanceMeters,
    match_method: best.match.method,
    match_score: best.match.score,
    equal_score_candidates: sameScore.length,
    confidence,
    action: 'report_only_do_not_modify',
  }];
}).sort((left, right) => {
  const rank: Record<string, number> = { high: 0, medium: 1, ambiguous: 2 };
  return (rank[left.confidence] ?? 99) - (rank[right.confidence] ?? 99)
    || right.distance_meters - left.distance_meters
    || left.city_id.localeCompare(right.city_id)
    || left.name.localeCompare(right.name);
});

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({
  schema_version: 1,
  generated_at: new Date().toISOString(),
  total_current_pois: pois.length,
  eligible_unreviewed_pois: eligiblePois.length,
  missing_city_ids: missingCityIds,
  findings,
}, null, 2)}\n`, 'utf8');
const counts = findings.reduce<Record<string, number>>((result, finding) => {
  result[finding.confidence] = (result[finding.confidence] ?? 0) + 1;
  return result;
}, {});
process.stdout.write(`Audited ${pois.length} current POIs; reported ${findings.length} unreviewed coordinate candidates (${JSON.stringify(counts)}); missing OSM coverage for ${missingCityIds.length} Cities to ${output}\n`);
