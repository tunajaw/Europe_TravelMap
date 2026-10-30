import { createHash } from 'node:crypto';

import { haversineKm } from '../preprocess/geo.ts';

export type ManualPoiOperation = 'add' | 'location_update';

export type ManualPoiDraft = {
  cityName: string;
  name: string;
  localizedName: string | null;
  operation: ManualPoiOperation;
  shortUrl: string;
};

export type ManualPoiReference = {
  manual_id: string;
  city_id: string;
  name: string;
  localized_name: string | null;
  latitude: number;
  longitude: number;
  operation: ManualPoiOperation;
  source_status: 'owner_confirmed_visit';
};

export type GooglePlaceCoordinateOverride = {
  google_place_id: string;
  target_poi_id?: string;
  city_id: string;
  name: string;
  latitude: number;
  longitude: number;
  source_status: 'owner_confirmed_google_maps_link';
};

export type PublicPoiReference = {
  poi_id: string;
  city_id: string;
  name: string;
  localized_name: string | null;
  original_name?: string;
  category: 'Attraction' | 'Unclassified';
  subcategory: string;
  latitude: number;
  longitude: number;
  review_status: string;
  [key: string]: unknown;
};

const EXCLUDED_RETAIL_CATEGORIES = new Set([
  'Shopping Mall', 'Supermarket', 'Convenience Store', 'Shop',
]);
const EXCLUDED_RETAIL_NAME = /\b(?:supermarket|supermarch[eé]|supermarkt|supermercado|supermercato|grocery|convenience|drugstore|drogerie|pharmacy|apotheke|chemist|aldi|lidl|carrefour|maxima|rewe|edeka|penny|netto|rossmann|dm drogerie|kaufland|spar|billa|tesco|auchan)\b/i;

const LOCATION_UPDATE = /\s+location update\s*$/i;

export function normalizeManualPoiName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function manualPoiNameHash(value: string): string {
  return createHash('sha256').update(normalizeManualPoiName(value)).digest('hex');
}

export function parseManualPoiSource(source: string): ManualPoiDraft[] {
  const drafts: ManualPoiDraft[] = [];
  let cityName = '';
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.match(/^([^*].*):$/);
    if (heading) {
      cityName = heading[1]!.trim();
      continue;
    }
    const item = line.match(/^\*\s+(.+?):\s+(https:\/\/maps\.app\.goo\.gl\/\S+)$/);
    if (!item) continue;
    if (!cityName) throw new Error(`Manual POI lacks a City heading: ${line}`);
    const rawName = item[1]!.trim();
    const operation: ManualPoiOperation = LOCATION_UPDATE.test(rawName) ? 'location_update' : 'add';
    const withoutOperation = rawName.replace(LOCATION_UPDATE, '').trim();
    const separator = withoutOperation.indexOf('/');
    const localizedName = separator >= 0 ? withoutOperation.slice(0, separator).trim() : null;
    const name = separator >= 0 ? withoutOperation.slice(separator + 1).trim() : withoutOperation;
    if (!name) throw new Error(`Manual POI lacks a primary name: ${line}`);
    drafts.push({ cityName, name, localizedName: localizedName || null, operation, shortUrl: item[2]! });
  }
  return drafts;
}

export function extractResolvedGoogleMapsLocation(url: string): {
  latitude: number;
  longitude: number;
  placeKey: string;
} {
  const decoded = decodeURIComponent(url);
  const dataCoordinate = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const viewportCoordinate = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const coordinate = dataCoordinate ?? viewportCoordinate;
  if (!coordinate) throw new Error('Resolved Google Maps URL lacks a coordinate');
  const latitude = Number(coordinate[1]);
  const longitude = Number(coordinate[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Resolved Google Maps URL has an invalid coordinate');
  }
  const rawPlaceKey = decoded.match(/!1s([^!/?&#]+)/)?.[1] ?? '';
  const placeKey = rawPlaceKey || `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
  return { latitude, longitude, placeKey };
}

export function manualPoiId(placeKey: string): string {
  return `manual-poi-${createHash('sha256').update(placeKey).digest('hex').slice(0, 14)}`;
}

export function applyGooglePlaceCoordinateOverride<
  T extends { googlePlaceId?: string; latitude: number; longitude: number },
>(
  candidate: T,
  overrides: ReadonlyMap<string, GooglePlaceCoordinateOverride>,
): T {
  const override = candidate.googlePlaceId
    ? overrides.get(candidate.googlePlaceId)
    : undefined;
  return override
    ? { ...candidate, latitude: override.latitude, longitude: override.longitude }
    : candidate;
}

function namesFor(reference: PublicPoiReference): string[] {
  return [reference.name, reference.localized_name, reference.original_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeManualPoiName);
}

export function mergeManualPoiReferences(
  existing: PublicPoiReference[],
  manual: ManualPoiReference[],
  reviewedNameHashes: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): {
  pois: PublicPoiReference[];
  added: number;
  updated: number;
  deduplicated: number;
  updatedPoiIds: string[];
} {
  const pois = existing.map((poi) => ({ ...poi }));
  let added = 0;
  let updated = 0;
  let deduplicated = 0;
  const updatedPoiIds: string[] = [];
  for (const row of manual) {
    const normalizedNames = [row.name, row.localized_name]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(normalizeManualPoiName);
    const manualNameHashes = new Set(normalizedNames.map((name) => manualPoiNameHash(name)));
    const cityPois = pois.filter((poi) => poi.city_id === row.city_id);
    const directMatches = cityPois.filter((poi) =>
      namesFor(poi).some((name) => normalizedNames.includes(name)));
    const reviewedAliasMatches = cityPois.filter((poi) =>
      [...(reviewedNameHashes.get(poi.poi_id) ?? [])]
        .some((hash) => manualNameHashes.has(hash)));
    if (reviewedAliasMatches.length > 1) {
      throw new Error(`Reviewed manual POI name is ambiguous in ${row.city_id}: ${row.name}`);
    }
    if (reviewedAliasMatches.length === 0 && directMatches.length > 1) {
      throw new Error(`Manual POI name is ambiguous in ${row.city_id}: ${row.name}`);
    }
    const match = reviewedAliasMatches[0] ?? directMatches[0];
    if (match) {
      if (reviewedAliasMatches.length === 1) {
        for (const duplicate of directMatches) {
          if (duplicate.poi_id === match.poi_id || reviewedNameHashes.has(duplicate.poi_id)) continue;
          const distanceMeters = haversineKm(
            { latitude: duplicate.latitude, longitude: duplicate.longitude },
            { latitude: row.latitude, longitude: row.longitude },
          ) * 1_000;
          if (distanceMeters > 250) continue;
          const duplicateIndex = pois.findIndex((poi) => poi.poi_id === duplicate.poi_id);
          if (duplicateIndex >= 0) {
            pois.splice(duplicateIndex, 1);
            deduplicated += 1;
          }
        }
      }
      match.latitude = row.latitude;
      match.longitude = row.longitude;
      match.name = row.name;
      if (row.localized_name) match.localized_name = row.localized_name;
      updated += 1;
      updatedPoiIds.push(match.poi_id);
      continue;
    }
    pois.push({
      poi_id: row.manual_id,
      city_id: row.city_id,
      name: row.name,
      localized_name: row.localized_name,
      original_name: row.name,
      category: 'Unclassified',
      subcategory: 'owner_confirmed_visit',
      latitude: row.latitude,
      longitude: row.longitude,
      review_status: 'provisional_owner_assumption',
    });
    added += 1;
  }
  return {
    pois: pois.sort((left, right) => left.city_id.localeCompare(right.city_id) || left.name.localeCompare(right.name)),
    added,
    updated,
    deduplicated,
    updatedPoiIds: [...new Set(updatedPoiIds)].sort(),
  };
}

export function isExcludedRetailPoi(poi: PublicPoiReference): boolean {
  const matchedCategory = poi.source_matched_category;
  if (typeof matchedCategory === 'string' && EXCLUDED_RETAIL_CATEGORIES.has(matchedCategory)) return true;
  const names = [poi.name, poi.localized_name, poi.original_name].filter(Boolean).join(' ');
  return EXCLUDED_RETAIL_NAME.test(normalizeManualPoiName(names));
}

export function prunePublicPoiReferences(
  source: PublicPoiReference[],
  denseDistanceMeters = 15,
  reviewedPoiIds: ReadonlySet<string> = new Set(),
): { pois: PublicPoiReference[]; retailRemoved: number; denseRemoved: number } {
  const withoutRetail = source.filter((poi) => reviewedPoiIds.has(poi.poi_id)
    || !isExcludedRetailPoi(poi));
  const retailRemoved = source.length - withoutRetail.length;
  const prioritized = [...withoutRetail].sort((left, right) => {
    const priority = (poi: PublicPoiReference): number => poi.category === 'Attraction'
      ? 0
      : reviewedPoiIds.has(poi.poi_id) ? 1
        : poi.subcategory === 'owner_confirmed_visit' ? 2 : 3;
    return priority(left) - priority(right)
      || left.city_id.localeCompare(right.city_id)
      || left.name.localeCompare(right.name);
  });
  const kept: PublicPoiReference[] = [];
  let denseRemoved = 0;
  for (const poi of prioritized) {
    if (poi.category === 'Attraction' || reviewedPoiIds.has(poi.poi_id)
      || poi.subcategory === 'owner_confirmed_visit') {
      kept.push(poi);
      continue;
    }
    const duplicate = kept.some((candidate) => candidate.city_id === poi.city_id
      && haversineKm(
        { latitude: candidate.latitude, longitude: candidate.longitude },
        { latitude: poi.latitude, longitude: poi.longitude },
      ) * 1_000 <= denseDistanceMeters);
    if (duplicate) denseRemoved += 1;
    else kept.push(poi);
  }
  return {
    pois: kept.sort((left, right) => left.city_id.localeCompare(right.city_id) || left.name.localeCompare(right.name)),
    retailRemoved,
    denseRemoved,
  };
}
