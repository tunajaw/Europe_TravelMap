import type { TravelData } from './travel-data.ts';

type Segment = TravelData['segments'][number];
type Transfer = TravelData['transfers'][number];

export interface TransportationMetricOptions {
  includeAirportTransfers: boolean;
}

export function calculateSegmentTotals(
  segment: Segment,
  transfers: Transfer[],
  options: TransportationMetricOptions,
): { costEur: number; distanceKm: number } {
  const includedTransfers = transfers.filter((transfer) => {
    if (transfer.segmentId !== segment.id || transfer.costEur === 0) return false;
    return transfer.expenseInclusion === 'always' || options.includeAirportTransfers;
  });

  return {
    costEur: round(segment.baseCostEur + includedTransfers.reduce((sum, transfer) => sum + transfer.costEur, 0), 2),
    distanceKm: round(
      segment.baseDistanceKm + includedTransfers.reduce((sum, transfer) => sum + transfer.distanceKm, 0),
      1,
    ),
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
