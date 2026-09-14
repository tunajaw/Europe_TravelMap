import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { calculateSegmentTotals } from '../../domain/transportation-metrics.ts';
import { TRANSPORT_MODES } from '../map/transport-colors.ts';
import { AccommodationBarplot } from './AccommodationBarplot.tsx';
import { AccommodationHeatmap } from './AccommodationHeatmap.tsx';
import {
  ACCOMMODATION_CATEGORIES,
  ACCOMMODATION_COLORS,
  accommodationScaleMaximum,
  buildAccommodationBarRows,
  buildAccommodationCategorySummaries,
  buildAccommodationHeatmapRows,
  type AccommodationCategory,
  type AccommodationMetric,
  type AccommodationSort,
} from './accommodation-data.ts';
import { TransportationBarplot } from './TransportationBarplot.tsx';
import { TransportationHeatmap } from './TransportationHeatmap.tsx';
import {
  buildTransportationBarRows,
  type TransportationCategory,
  type TransportationMetric,
  type TransportationSort,
} from './transportation-bar-data.ts';
import { buildTransportationHeatmapScaleMaximum } from './transportation-heatmap-data.ts';
import './expense-explorer.css';

type ExpenseView = 'transportation' | 'accommodation';

const VIEWS: ReadonlyArray<{ id: ExpenseView; label: string }> = [
  { id: 'transportation', label: 'Transportation' },
  { id: 'accommodation', label: 'Accommodation' },
];

type ExpenseData = Pick<TravelData, 'accommodations' | 'cities' | 'countries' | 'segments' | 'transfers'>;

export function ExpenseExplorer({ data }: { data: ExpenseData }) {
  const [view, setView] = useState<ExpenseView>('transportation');
  const [includeAirportTransfers, setIncludeAirportTransfers] = useState(true);
  const [includeZeroCostSegments, setIncludeZeroCostSegments] = useState(true);
  const [transportationMetric, setTransportationMetric] = useState<TransportationMetric>('total-cost');
  const [transportationSort, setTransportationSort] = useState<TransportationSort>('descending');
  const [selectedCategories, setSelectedCategories] = useState<TransportationCategory[]>(
    () => TRANSPORT_MODES.map(([category]) => category),
  );
  const [accommodationMetric, setAccommodationMetric] = useState<AccommodationMetric>('nightly-price');
  const [accommodationSort, setAccommodationSort] = useState<AccommodationSort>('descending');
  const [selectedAccommodationCategories, setSelectedAccommodationCategories] = useState<AccommodationCategory[]>(
    () => ACCOMMODATION_CATEGORIES.filter((category) => category !== 'Airport'),
  );
  const activeLabel = VIEWS.find(({ id }) => id === view)?.label ?? 'Transportation';
  const categorySummaries = TRANSPORT_MODES.map(([category, color]) => {
    const segmentCosts = data.segments
      .filter((segment) => segment.transportationCategory === category)
      .map((segment) => calculateSegmentTotals(
        segment,
        data.transfers,
        { includeAirportTransfers },
      ).costEur)
      .filter((costEur) => includeZeroCostSegments || costEur !== 0);
    const totalCostEur = segmentCosts.reduce((total, costEur) => total + costEur, 0);
    return {
      category,
      color,
      totalCostEur,
      averageCostEur: segmentCosts.length ? totalCostEur / segmentCosts.length : 0,
    };
  });
  const barRows = buildTransportationBarRows(data.segments, data.transfers, {
    categories: selectedCategories,
    includeAirportTransfers,
    includeZeroCostSegments,
    metric: transportationMetric,
    sort: transportationSort,
  });
  const heatmapScaleMaximum = useMemo(
    () => buildTransportationHeatmapScaleMaximum(data.segments, data.transfers, transportationMetric),
    [data.segments, data.transfers, transportationMetric],
  );
  const accommodationSummaries = useMemo(
    () => buildAccommodationCategorySummaries(data.accommodations),
    [data.accommodations],
  );
  const accommodationBarRows = buildAccommodationBarRows(data.accommodations, {
    categories: selectedAccommodationCategories,
    metric: accommodationMetric,
    sort: accommodationSort,
  });
  const accommodationHeatmapRows = buildAccommodationHeatmapRows(data.accommodations, {
    categories: selectedAccommodationCategories,
    metric: accommodationMetric,
  });
  const accommodationHeatmapMaximum = useMemo(
    () => accommodationScaleMaximum(data.accommodations, accommodationMetric),
    [data.accommodations, accommodationMetric],
  );

  function toggleCategory(category: TransportationCategory) {
    setSelectedCategories((current) => current.includes(category)
      ? current.filter((selected) => selected !== category)
      : [...current, category]);
  }

  function toggleAccommodationCategory(category: AccommodationCategory) {
    setSelectedAccommodationCategories((current) => current.includes(category)
      ? current.filter((selected) => selected !== category)
      : [...current, category]);
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % VIEWS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + VIEWS.length) % VIEWS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = VIEWS.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextView = VIEWS[nextIndex];
    if (!nextView) return;
    setView(nextView.id);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#${nextView.id}-expense-tab`)
      ?.focus();
  }

  return (
    <section className="expense-workspace" aria-labelledby="expense-heading">
      <p className="eyebrow">Travel costs</p>
      <h1 id="expense-heading">Expense overview</h1>

      <div className="expense-view-tabs" role="tablist" aria-label="Expense view">
        {VIEWS.map(({ id, label }, index) => (
          <button
            aria-controls={`${id}-expense-panel`}
            aria-selected={view === id}
            className="expense-view-tab"
            id={`${id}-expense-tab`}
            key={id}
            onClick={() => setView(id)}
            onKeyDown={(event) => handleTabKey(event, index)}
            role="tab"
            tabIndex={view === id ? 0 : -1}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <section
        aria-labelledby={`${view}-expense-tab`}
        className="expense-view-panel"
        id={`${view}-expense-panel`}
        role="tabpanel"
      >
        <h2>{activeLabel}</h2>
        {view === 'transportation' && (
          <div className="transportation-categories" role="group" aria-label="Transportation categories">
            {categorySummaries.map(({ category, color, totalCostEur, averageCostEur }) => (
              <button
                aria-pressed={selectedCategories.includes(category)}
                className="transportation-category"
                key={category}
                onClick={() => toggleCategory(category)}
                style={{ '--category-color': color } as CSSProperties}
                type="button"
              >
                <span className="transportation-category-name">{category}</span>
                <span>Total EUR {totalCostEur.toFixed(2)}</span>
                <span>Avg. EUR {averageCostEur.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
        {view === 'accommodation' && (
          <div className="transportation-categories accommodation-categories" role="group" aria-label="Accommodation categories">
            {accommodationSummaries.map((summary) => (
              <button
                aria-pressed={selectedAccommodationCategories.includes(summary.category)}
                className="transportation-category"
                key={summary.category}
                onClick={() => toggleAccommodationCategory(summary.category)}
                style={{ '--category-color': ACCOMMODATION_COLORS[summary.category] } as CSSProperties}
                type="button"
              >
                <span className="transportation-category-name">{summary.category}</span>
                <span>Total EUR {summary.totalCostEur.toFixed(2)}</span>
                <span>Avg. EUR {summary.averageNightlyCostEur.toFixed(2)} / night</span>
                <span>Avg. commute {summary.averageCommuteMinutes === null
                  ? 'Not applicable'
                  : `${summary.averageCommuteMinutes.toFixed(2)} min`}</span>
              </button>
            ))}
          </div>
        )}
        {view === 'transportation' && (
          <div className="expense-filters" aria-label="Transportation options">
            <label>
              <input
                checked={includeAirportTransfers}
                onChange={(event) => setIncludeAirportTransfers(event.target.checked)}
                type="checkbox"
              />
              Include airport transfers
            </label>
            <label>
              <input
                checked={includeZeroCostSegments}
                onChange={(event) => setIncludeZeroCostSegments(event.target.checked)}
                type="checkbox"
              />
              Include 0-Cost Segments
            </label>
          </div>
        )}
        {view === 'transportation' && (
          <div className="expense-analysis-controls">
            <label>
              <span>Display</span>
              <select
                aria-label="Display metric"
                onChange={(event) => setTransportationMetric(event.target.value as TransportationMetric)}
                value={transportationMetric}
              >
                <option value="total-cost">Total cost</option>
                <option value="cost-per-100-km">Cost per 100 km</option>
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select
                aria-label="Sort order"
                onChange={(event) => setTransportationSort(event.target.value as TransportationSort)}
                value={transportationSort}
              >
                <option value="descending">Highest to lowest</option>
                <option value="ascending">Lowest to highest</option>
                <option value="chronological">Chronological</option>
              </select>
            </label>
          </div>
        )}
        {view === 'accommodation' && (
          <div className="expense-analysis-controls">
            <label><span>Display</span>
              <select aria-label="Accommodation display metric" onChange={(event) => setAccommodationMetric(event.target.value as AccommodationMetric)} value={accommodationMetric}>
                <option value="nightly-price">Average nightly price</option>
                <option value="commute">Commute to main station</option>
              </select>
            </label>
            <label><span>Sort</span>
              <select aria-label="Accommodation sort order" onChange={(event) => setAccommodationSort(event.target.value as AccommodationSort)} value={accommodationSort}>
                <option value="descending">Highest to lowest</option>
                <option value="ascending">Lowest to highest</option>
                <option value="chronological">Chronological</option>
                <option value="rating">Rating (highest first)</option>
              </select>
            </label>
          </div>
        )}
        {view === 'transportation' && (
          <div className="expense-visualizations">
            <TransportationBarplot
              cities={data.cities}
              includeAirportTransfers={includeAirportTransfers}
              metric={transportationMetric}
              rows={barRows}
              segments={data.segments}
              transfers={data.transfers}
            />
            <TransportationHeatmap
              countries={data.countries}
              metric={transportationMetric}
              scaleMaximum={heatmapScaleMaximum}
              segmentRows={barRows}
            />
          </div>
        )}
        {view === 'accommodation' && (
          <div className="expense-visualizations">
            <AccommodationBarplot cities={data.cities} metric={accommodationMetric} rows={accommodationBarRows} />
            <AccommodationHeatmap countries={data.countries} data={accommodationHeatmapRows}
              metric={accommodationMetric} scaleMaximum={accommodationHeatmapMaximum} />
          </div>
        )}
      </section>
    </section>
  );
}
