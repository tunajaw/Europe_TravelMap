import { describe, expect, it } from 'vitest';
import type { TravelData } from '../../src/domain/travel-data.ts';
import { buildTransportationBarRows } from '../../src/features/expense/transportation-bar-data.ts';
import {
  buildTransportationHeatmapRows,
  buildTransportationHeatmapScaleMaximum,
} from '../../src/features/expense/transportation-heatmap-data.ts';

const segments = [
  { id: 'a-1', date: '2026-01-01', globalSequence: 1, originCountryId: 'a', transportationCategory: 'Plane', baseCostEur: 10, baseDistanceKm: 100 },
  { id: 'a-2', date: '2026-01-02', globalSequence: 2, originCountryId: 'a', transportationCategory: 'Train', baseCostEur: 30, baseDistanceKm: 100 },
  { id: 'b-1', date: '2026-01-03', globalSequence: 3, originCountryId: 'b', transportationCategory: 'Plane', baseCostEur: 10, baseDistanceKm: 200 },
] as TravelData['segments'];

describe('Transportation heatmap data', () => {
  it('aggregates each Segment only under its departure Country', () => {
    const segmentRows = buildTransportationBarRows(segments, [], {
      categories: ['Plane', 'Train'],
      includeAirportTransfers: true,
      includeZeroCostSegments: true,
      metric: 'total-cost',
      sort: 'descending',
    });

    expect(buildTransportationHeatmapRows(segmentRows)).toEqual([
      { countryId: 'a', segmentCount: 2, average: 20, standardDeviation: 10, rank: 1 },
      { countryId: 'b', segmentCount: 1, average: 10, standardDeviation: 0, rank: 2 },
    ]);
  });

  it('uses tied ranks and gives each metric an independent full-data scale', () => {
    expect(buildTransportationHeatmapScaleMaximum(segments, [], 'total-cost')).toBe(20);
    expect(buildTransportationHeatmapScaleMaximum(segments, [], 'cost-per-100-km')).toBe(20);

    const tieRows = buildTransportationBarRows([segments[0]!, segments[2]!], [], {
      categories: ['Plane'],
      includeAirportTransfers: true,
      includeZeroCostSegments: true,
      metric: 'total-cost',
      sort: 'descending',
    });
    expect(buildTransportationHeatmapRows(tieRows).map(({ rank }) => rank)).toEqual([1, 1]);
  });
});
