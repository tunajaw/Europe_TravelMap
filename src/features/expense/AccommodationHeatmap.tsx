import type { TravelData } from '../../domain/travel-data.ts';
import { ExpenseCountryHeatmap } from './ExpenseCountryHeatmap.tsx';
import type { AccommodationHeatmapRow, AccommodationMetric } from './accommodation-data.ts';

export function AccommodationHeatmap({ countries, data, metric, scaleMaximum }: {
  countries: TravelData['countries']; data: AccommodationHeatmapRow[]; metric: AccommodationMetric; scaleMaximum: number;
}) {
  const formatMetric = (value: number) => metric === 'nightly-price'
    ? `EUR ${value.toFixed(2)} / night` : `${value.toFixed(2)} min`;
  return <ExpenseCountryHeatmap ariaLabel="Accommodation expense heatmap" countLabel="Nights" countries={countries}
    data={data.map((row) => ({ ...row, count: row.nights }))} eyebrow="Country weighted average" formatMetric={formatMetric}
    heading="Accommodation heatmap" prompt="Hover over or focus a Country to inspect its accommodation average. Click to lock it."
    scaleMaximum={scaleMaximum} />;
}
