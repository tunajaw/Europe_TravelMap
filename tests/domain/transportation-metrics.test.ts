import { describe, expect, it } from 'vitest';
import { calculateSegmentTotals } from '../../src/domain/transportation-metrics.ts';
import type { TravelData } from '../../src/domain/travel-data.ts';

const segment = {
  id: 'segment-001',
  baseCostEur: 10,
  baseDistanceKm: 100,
} as TravelData['segments'][number];

const transfers = [
  { segmentId: segment.id, expenseInclusion: 'always', costEur: 2, distanceKm: 3 },
  { segmentId: segment.id, expenseInclusion: 'airport-filter', costEur: 5, distanceKm: 10 },
  { segmentId: segment.id, expenseInclusion: 'airport-filter', costEur: 0, distanceKm: 20 },
] as TravelData['transfers'];

describe('Transportation Segment totals', () => {
  it('always includes paid local endpoint Transfers', () => {
    expect(calculateSegmentTotals(segment, transfers, { includeAirportTransfers: false })).toEqual({
      costEur: 12,
      distanceKm: 103,
    });
  });

  it('includes only paid Airport Transfers when their filter is enabled', () => {
    expect(calculateSegmentTotals(segment, transfers, { includeAirportTransfers: true })).toEqual({
      costEur: 17,
      distanceKm: 113,
    });
  });
});
