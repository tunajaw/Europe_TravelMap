import type { TravelData } from '../../domain/travel-data.ts';
import { calculateSegmentTotals } from '../../domain/transportation-metrics.ts';

type Segment = TravelData['segments'][number];
type Transfer = TravelData['transfers'][number];
export type TransportationCategory = Segment['transportationCategory'];
export type TransportationMetric = 'total-cost' | 'cost-per-100-km';
export type TransportationSort = 'descending' | 'ascending' | 'chronological';

export interface TransportationBarOptions {
  categories: TransportationCategory[];
  includeAirportTransfers: boolean;
  includeZeroCostSegments: boolean;
  metric: TransportationMetric;
  sort: TransportationSort;
}

export interface TransportationBarRow {
  segmentId: string;
  date: string;
  globalSequence: number;
  originCityId: string;
  destinationCityId: string;
  category: TransportationCategory;
  costEur: number;
  distanceKm: number;
  value: number;
}

export function buildTransportationBarRows(
  segments: Segment[],
  transfers: Transfer[],
  options: TransportationBarOptions,
): TransportationBarRow[] {
  const selectedCategories = new Set(options.categories);
  const rows = segments
    .filter((segment) => selectedCategories.has(segment.transportationCategory))
    .map((segment) => {
      const totals = calculateSegmentTotals(segment, transfers, options);
      return {
        segmentId: segment.id,
        date: segment.date,
        globalSequence: segment.globalSequence,
        originCityId: segment.originCityId,
        destinationCityId: segment.destinationCityId,
        category: segment.transportationCategory,
        costEur: totals.costEur,
        distanceKm: totals.distanceKm,
        value: options.metric === 'total-cost'
          ? totals.costEur
          : round(totals.distanceKm === 0 ? 0 : totals.costEur / totals.distanceKm * 100, 2),
      };
    })
    .filter(({ costEur }) => options.includeZeroCostSegments || costEur !== 0);

  return rows.sort((left, right) => {
    const chronological = left.date.localeCompare(right.date)
      || left.globalSequence - right.globalSequence;
    if (options.sort === 'chronological') return chronological;
    const valueDifference = left.value - right.value;
    if (valueDifference === 0) return chronological;
    return options.sort === 'ascending' ? valueDifference : -valueDifference;
  });
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
