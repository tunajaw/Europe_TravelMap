import { describe, expect, it } from 'vitest';
import type { TravelData } from '../../src/domain/travel-data.ts';
import { buildTransportationBarRows } from '../../src/features/expense/transportation-bar-data.ts';

const segments = [
  {
    id: 'plane-later', date: '2026-01-03', globalSequence: 3,
    transportationCategory: 'Plane', baseCostEur: 10, baseDistanceKm: 100,
  },
  {
    id: 'plane-airport-only', date: '2026-01-01', globalSequence: 1,
    transportationCategory: 'Plane', baseCostEur: 0, baseDistanceKm: 100,
  },
  {
    id: 'train-earlier', date: '2026-01-02', globalSequence: 2,
    transportationCategory: 'Train', baseCostEur: 12, baseDistanceKm: 80,
  },
] as TravelData['segments'];

const transfers = [
  { segmentId: 'plane-later', expenseInclusion: 'airport-filter', costEur: 5, distanceKm: 50 },
  { segmentId: 'plane-airport-only', expenseInclusion: 'airport-filter', costEur: 5, distanceKm: 50 },
  { segmentId: 'train-earlier', expenseInclusion: 'always', costEur: 3, distanceKm: 20 },
] as TravelData['transfers'];

describe('Transportation bar data', () => {
  it('applies Transfers, category filters, and value sorting with chronological ties', () => {
    const rows = buildTransportationBarRows(segments, transfers, {
      categories: ['Plane', 'Train'],
      includeAirportTransfers: true,
      includeZeroCostSegments: true,
      metric: 'total-cost',
      sort: 'descending',
    });

    expect(rows.map(({ segmentId }) => segmentId)).toEqual([
      'train-earlier',
      'plane-later',
      'plane-airport-only',
    ]);
    expect(rows.map(({ value }) => value)).toEqual([15, 15, 5]);
  });

  it('calculates cost per 100 km from final cost and distance', () => {
    const rows = buildTransportationBarRows(segments, transfers, {
      categories: ['Plane', 'Train'],
      includeAirportTransfers: true,
      includeZeroCostSegments: true,
      metric: 'cost-per-100-km',
      sort: 'descending',
    });

    expect(rows.map(({ segmentId, value }) => [segmentId, value])).toEqual([
      ['train-earlier', 15],
      ['plane-later', 10],
      ['plane-airport-only', 3.33],
    ]);
  });

  it('removes final zero-cost Segments after Airport Transfers are excluded', () => {
    const rows = buildTransportationBarRows(segments, transfers, {
      categories: ['Plane'],
      includeAirportTransfers: false,
      includeZeroCostSegments: false,
      metric: 'total-cost',
      sort: 'chronological',
    });

    expect(rows.map(({ segmentId, value }) => [segmentId, value])).toEqual([
      ['plane-later', 10],
    ]);
  });
});
