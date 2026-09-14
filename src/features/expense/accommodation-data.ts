import type { TravelData } from '../../domain/travel-data.ts';

type Accommodation = TravelData['accommodations'][number];
export type AccommodationCategory = Accommodation['type'];
export type AccommodationMetric = 'nightly-price' | 'commute';
export type AccommodationSort = 'descending' | 'ascending' | 'chronological' | 'rating';

export const ACCOMMODATION_CATEGORIES: readonly AccommodationCategory[] = ['Airbnb', 'Hostel', 'Hotel', 'Airport'];
export const ACCOMMODATION_COLORS: Record<Accommodation['type'], string> = {
  Airbnb: '#e9a5a9',
  Hostel: '#9ed6b1',
  Hotel: '#6c9ed3',
  Airport: '#e4bf62',
};

export interface AccommodationOptions {
  categories: AccommodationCategory[];
  metric: AccommodationMetric;
  sort: AccommodationSort;
}

export interface AccommodationBarRow {
  accommodationId: string;
  sequence: number;
  cityId: string;
  countryId: string;
  type: Accommodation['type'];
  label: string;
  nights: number;
  pricePerNightEur: number;
  commuteMinutes: number | null;
  rating: Accommodation['rating'];
  notes: string | null;
  nearestStationName: string | null;
  value: number;
}

export interface AccommodationCategorySummary {
  category: AccommodationCategory;
  totalCostEur: number;
  averageNightlyCostEur: number;
  averageCommuteMinutes: number | null;
}

export interface AccommodationHeatmapRow {
  countryId: string;
  nights: number;
  average: number;
  standardDeviation: number;
  rank: number;
}

export function buildAccommodationCategorySummaries(
  accommodations: TravelData['accommodations'],
): AccommodationCategorySummary[] {
  return ACCOMMODATION_CATEGORIES.map((category) => {
    const rows = accommodations.filter(({ type }) => type === category);
    const nights = rows.reduce((sum, row) => sum + row.nights, 0);
    const commuteNights = rows.filter(({ commuteMinutes }) => commuteMinutes !== null)
      .reduce((sum, row) => sum + row.nights, 0);
    return {
      category,
      totalCostEur: round(rows.reduce((sum, row) => sum + row.totalCostEur, 0)),
      averageNightlyCostEur: round(nights
        ? rows.reduce((sum, row) => sum + row.totalCostEur, 0) / nights
        : 0),
      averageCommuteMinutes: commuteNights
        ? round(rows.reduce((sum, row) => sum + (row.commuteMinutes ?? 0) * row.nights, 0) / commuteNights)
        : null,
    };
  });
}

export function buildAccommodationBarRows(
  accommodations: TravelData['accommodations'],
  options: AccommodationOptions,
): AccommodationBarRow[] {
  const selected = new Set(options.categories);
  return accommodations
    .filter((row) => selected.has(row.type))
    .filter((row) => options.metric === 'nightly-price' || row.commuteMinutes !== null)
    .map((row) => ({
      accommodationId: row.id,
      sequence: row.sequence,
      cityId: row.cityId,
      countryId: row.countryId,
      type: row.type,
      label: row.label,
      nights: row.nights,
      pricePerNightEur: row.pricePerNightEur,
      commuteMinutes: row.commuteMinutes,
      rating: row.rating,
      notes: row.notes,
      nearestStationName: row.nearestStationName,
      value: options.metric === 'nightly-price' ? row.pricePerNightEur : row.commuteMinutes ?? 0,
    }))
    .sort((left, right) => {
      if (options.sort === 'chronological') return left.sequence - right.sequence;
      if (options.sort === 'rating') {
        return right.rating.total - left.rating.total || left.sequence - right.sequence;
      }
      const difference = left.value - right.value;
      if (difference === 0) return left.sequence - right.sequence;
      return options.sort === 'ascending' ? difference : -difference;
    });
}

export function buildAccommodationHeatmapRows(
  accommodations: TravelData['accommodations'],
  options: Pick<AccommodationOptions, 'categories' | 'metric'>,
): AccommodationHeatmapRow[] {
  const selected = new Set(options.categories);
  const included = accommodations
    .filter((row) => selected.has(row.type))
    .filter((row) => options.metric === 'nightly-price' || row.commuteMinutes !== null);
  const byCountry = new Map<string, Accommodation[]>();
  for (const row of included) byCountry.set(row.countryId, [...(byCountry.get(row.countryId) ?? []), row]);

  const aggregated = [...byCountry].map(([countryId, rows]) => {
    const nights = rows.reduce((sum, row) => sum + row.nights, 0);
    const values = rows.map((row) => ({
      nights: row.nights,
      value: options.metric === 'nightly-price' ? row.pricePerNightEur : row.commuteMinutes ?? 0,
    }));
    const average = values.reduce((sum, row) => sum + row.value * row.nights, 0) / nights;
    const variance = values.reduce((sum, row) => sum + (row.value - average) ** 2 * row.nights, 0) / nights;
    return {
      countryId,
      nights,
      average: round(average),
      standardDeviation: round(Math.sqrt(variance)),
      rank: 0,
    };
  }).sort((left, right) => right.average - left.average || left.countryId.localeCompare(right.countryId));

  let previousAverage: number | undefined;
  let previousRank = 0;
  return aggregated.map((row, index) => {
    const rank = previousAverage === row.average ? previousRank : index + 1;
    previousAverage = row.average;
    previousRank = rank;
    return { ...row, rank };
  });
}

export function accommodationScaleMaximum(
  accommodations: TravelData['accommodations'],
  metric: AccommodationMetric,
): number {
  return Math.max(0, ...accommodations.flatMap((row) => {
    const value = metric === 'nightly-price' ? row.pricePerNightEur : row.commuteMinutes;
    return value === null ? [] : [value];
  }));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
