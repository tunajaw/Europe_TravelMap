import type { TravelData } from '../../domain/travel-data.ts';
import { ExpenseCountryHeatmap } from './ExpenseCountryHeatmap.tsx';
import type { TransportationMetric } from './transportation-bar-data.ts';
import { buildTransportationHeatmapRows } from './transportation-heatmap-data.ts';

export function TransportationHeatmap({ countries, metric, scaleMaximum, segmentRows }: {
  countries: TravelData['countries'];
  metric: TransportationMetric;
  scaleMaximum: number;
  segmentRows: Parameters<typeof buildTransportationHeatmapRows>[0];
}) {
  const formatMetric = (value: number) => metric === 'total-cost'
    ? `EUR ${value.toFixed(2)}`
    : `EUR ${value.toFixed(2)} / 100 km`;
  const data = buildTransportationHeatmapRows(segmentRows).map((row) => ({
    countryId: row.countryId,
    count: row.segmentCount,
    average: row.average,
    standardDeviation: row.standardDeviation,
    rank: row.rank,
  }));
  return <ExpenseCountryHeatmap
    ariaLabel="Transportation expense heatmap"
    countLabel="Segments"
    countries={countries}
    data={data}
    eyebrow="Country average"
    formatMetric={formatMetric}
    heading="Transportation heatmap"
    prompt="Hover over or focus a Country to inspect its transportation average. Click to lock it."
    scaleMaximum={scaleMaximum}
  />;
}
