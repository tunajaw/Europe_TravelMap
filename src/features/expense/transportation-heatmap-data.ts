import type { TravelData } from '../../domain/travel-data.ts';
import {
  buildTransportationBarRows,
  type TransportationBarRow,
  type TransportationMetric,
} from './transportation-bar-data.ts';

export interface TransportationHeatmapRow {
  countryId: string;
  segmentCount: number;
  average: number;
  standardDeviation: number;
  rank: number;
}

export function buildTransportationHeatmapRows(
  segmentRows: readonly TransportationBarRow[],
): TransportationHeatmapRow[] {
  const valuesByCountry = new Map<string, number[]>();
  for (const row of segmentRows) {
    const values = valuesByCountry.get(row.originCountryId) ?? [];
    values.push(row.value);
    valuesByCountry.set(row.originCountryId, values);
  }

  const aggregated = [...valuesByCountry].map(([countryId, values]) => {
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
    return {
      countryId,
      segmentCount: values.length,
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

export function buildTransportationHeatmapScaleMaximum(
  segments: TravelData['segments'],
  transfers: TravelData['transfers'],
  metric: TransportationMetric,
): number {
  const categories = [...new Set(segments.map(({ transportationCategory }) => transportationCategory))];
  const referenceRows = buildTransportationBarRows(segments, transfers, {
    categories,
    includeAirportTransfers: true,
    includeZeroCostSegments: true,
    metric,
    sort: 'chronological',
  });
  return Math.max(0, ...buildTransportationHeatmapRows(referenceRows).map(({ average }) => average));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
