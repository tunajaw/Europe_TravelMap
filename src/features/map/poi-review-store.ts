import type { TravelData } from '../../domain/travel-data.ts';

export const POI_REVIEW_STORAGE_KEY = 'europe-travel-map:poi-reviews:v1';
export const POI_REVIEW_SCHEMA_VERSION = 1;

export const POI_REVIEW_CATEGORIES = ['Attractions', 'Shop', 'Restaurant'] as const;
export type PoiReviewCategory = typeof POI_REVIEW_CATEGORIES[number];
export type PoiReviewDecision = 'Keep' | 'Discard';

export type PoiReviewRecord = {
  poiId: string;
  editedName: string;
  decision: PoiReviewDecision;
  categories: PoiReviewCategory[];
  reviewStatus: 'reviewed';
  updatedAt: string;
};

export type PoiReviewMap = Record<string, PoiReviewRecord>;

type PoiReviewFile = {
  schemaVersion: 1;
  exportedAt: string;
  reviews: PoiReviewRecord[];
};

function isReviewRecord(value: unknown): value is PoiReviewRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<PoiReviewRecord>;
  return typeof row.poiId === 'string' && row.poiId.length > 0
    && typeof row.editedName === 'string'
    && (row.decision === 'Keep' || row.decision === 'Discard')
    && Array.isArray(row.categories)
    && row.categories.every((category) => POI_REVIEW_CATEGORIES.includes(category as PoiReviewCategory))
    && row.reviewStatus === 'reviewed'
    && typeof row.updatedAt === 'string';
}

export function parsePoiReviewFile(source: string): PoiReviewMap {
  const parsed = JSON.parse(source) as Partial<PoiReviewFile>;
  if (parsed.schemaVersion !== POI_REVIEW_SCHEMA_VERSION || !Array.isArray(parsed.reviews)) {
    throw new Error('Unsupported POI review file');
  }
  const reviews: PoiReviewMap = {};
  for (const record of parsed.reviews) {
    if (!isReviewRecord(record)) throw new Error('Invalid POI review record');
    reviews[record.poiId] = record;
  }
  return reviews;
}

export function serializePoiReviews(reviews: PoiReviewMap, exportedAt = new Date().toISOString()): string {
  const file: PoiReviewFile = {
    schemaVersion: POI_REVIEW_SCHEMA_VERSION,
    exportedAt,
    reviews: Object.values(reviews).sort((left, right) => left.poiId.localeCompare(right.poiId)),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function loadPoiReviews(storage: Pick<Storage, 'getItem'> = window.localStorage): PoiReviewMap {
  const source = storage.getItem(POI_REVIEW_STORAGE_KEY);
  if (!source) return {};
  try {
    return parsePoiReviewFile(source);
  } catch {
    return {};
  }
}

export function persistPoiReviews(
  reviews: PoiReviewMap,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  storage.setItem(POI_REVIEW_STORAGE_KEY, serializePoiReviews(reviews));
}

export function upsertPoiReview(reviews: PoiReviewMap, record: PoiReviewRecord): PoiReviewMap {
  return { ...reviews, [record.poiId]: record };
}

export function reviewedPoiCount(poiIds: string[], reviews: PoiReviewMap): number {
  return poiIds.filter((id) => Boolean(reviews[id])).length;
}

export function cityReviewProgress(
  cityId: string,
  pois: NonNullable<TravelData['pois']>,
  reviews: PoiReviewMap,
): { reviewed: number; total: number; complete: boolean } {
  const ids = pois.filter((poi) => poi.cityId === cityId).map((poi) => poi.id);
  const reviewed = reviewedPoiCount(ids, reviews);
  return { reviewed, total: ids.length, complete: reviewed === ids.length };
}

export function countryReviewProgress(
  countryId: string,
  data: TravelData,
  reviews: PoiReviewMap,
): { reviewedCities: number; totalCities: number; reviewedPois: number; totalPois: number; complete: boolean } {
  const cities = data.cities.filter((city) => city.countryId === countryId);
  const progress = cities.map((city) => cityReviewProgress(city.id, data.pois ?? [], reviews));
  const reviewedCities = progress.filter(({ complete }) => complete).length;
  const reviewedPois = progress.reduce((sum, row) => sum + row.reviewed, 0);
  const totalPois = progress.reduce((sum, row) => sum + row.total, 0);
  return {
    reviewedCities,
    totalCities: cities.length,
    reviewedPois,
    totalPois,
    complete: reviewedCities === cities.length,
  };
}
