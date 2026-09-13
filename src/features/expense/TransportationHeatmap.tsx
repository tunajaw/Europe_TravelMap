import { geoPath } from 'd3-geo';
import { scaleLinear } from 'd3-scale';
import { useMemo, useState, type WheelEvent } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { MAP_HEIGHT, MAP_WIDTH, europeProjection } from '../map/country-label-layout.ts';
import { worldCountries } from '../map/world-geography.ts';
import type { TransportationMetric } from './transportation-bar-data.ts';
import {
  buildTransportationHeatmapRows,
  type TransportationHeatmapRow,
} from './transportation-heatmap-data.ts';

const path = geoPath(europeProjection);
type ViewBox = [number, number, number, number];

export function TransportationHeatmap({
  countries,
  metric,
  scaleMaximum,
  segmentRows,
}: {
  countries: TravelData['countries'];
  metric: TransportationMetric;
  scaleMaximum: number;
  segmentRows: Parameters<typeof buildTransportationHeatmapRows>[0];
}) {
  const [hoveredCountryId, setHoveredCountryId] = useState<string | null>(null);
  const [lockedCountryId, setLockedCountryId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState<ViewBox>([0, 0, MAP_WIDTH, MAP_HEIGHT]);
  const heatmapRows = useMemo(() => buildTransportationHeatmapRows(segmentRows), [segmentRows]);
  const rowByCountry = new Map(heatmapRows.map((row) => [row.countryId, row]));
  const countryByBoundary = new Map(countries.map((country) => [country.boundaryId, country]));
  const activeCountryId = hoveredCountryId ?? lockedCountryId;
  const activeCountry = countries.find(({ id }) => id === activeCountryId);
  const activeRow = activeCountry ? rowByCountry.get(activeCountry.id) : undefined;
  const color = scaleLinear<string>()
    .domain([0, Math.max(scaleMaximum, 1)])
    .range(['#b8d9ee', '#173f6d'])
    .clamp(true);

  function formatMetric(value: number): string {
    return metric === 'total-cost'
      ? `EUR ${value.toFixed(2)}`
      : `EUR ${value.toFixed(2)} / 100 km`;
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    if (event.deltaY === 0) return;
    const [x, y, width, height] = viewBox;
    const factor = event.deltaY < 0 ? 0.82 : 1.22;
    const nextWidth = Math.min(MAP_WIDTH, Math.max(MAP_WIDTH / 4, width * factor));
    if (nextWidth === width) return;
    event.preventDefault();
    const nextHeight = nextWidth * MAP_HEIGHT / MAP_WIDTH;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratioX = bounds.width > 0 ? clamp((event.clientX - bounds.left) / bounds.width, 0, 1) : 0.5;
    const ratioY = bounds.height > 0 ? clamp((event.clientY - bounds.top) / bounds.height, 0, 1) : 0.5;
    const nextX = clamp(x + ratioX * (width - nextWidth), 0, MAP_WIDTH - nextWidth);
    const nextY = clamp(y + ratioY * (height - nextHeight), 0, MAP_HEIGHT - nextHeight);
    setViewBox([nextX, nextY, nextWidth, nextHeight]);
  }

  function renderMetadata(country: TravelData['countries'][number], row?: TransportationHeatmapRow) {
    return (
      <section
        aria-label={`${country.name} heatmap details`}
        className="transportation-heatmap-details"
        key={country.id}
        role="region"
      >
        <h4>{country.name}</h4>
        <dl>
          <div><dt>Segments</dt><dd>{row?.segmentCount ?? 0}</dd></div>
          <div>
            <dt>Average ± standard deviation</dt>
            <dd>{row ? `${formatMetric(row.average)} ± ${formatMetric(row.standardDeviation)}` : 'No data'}</dd>
          </div>
          <div><dt>Rank</dt><dd>{row ? `#${row.rank}` : 'Not ranked'}</dd></div>
        </dl>
      </section>
    );
  }

  return (
    <section className="transportation-heatmap" aria-labelledby="transportation-heatmap-heading">
      <div className="transportation-heatmap-heading">
        <div>
          <p className="eyebrow">Country average</p>
          <h3 id="transportation-heatmap-heading">Transportation heatmap</h3>
        </div>
        <button
          disabled={viewBox[2] === MAP_WIDTH}
          onClick={() => setViewBox([0, 0, MAP_WIDTH, MAP_HEIGHT])}
          type="button"
        >
          Reset zoom
        </button>
      </div>

      <svg
        aria-label="Transportation expense heatmap"
        className="transportation-heatmap-map"
        onMouseLeave={() => setHoveredCountryId(null)}
        onWheel={handleWheel}
        role="group"
        viewBox={viewBox.join(' ')}
      >
        <rect className="transportation-heatmap-sea" height={MAP_HEIGHT} width={MAP_WIDTH} />
        <g aria-label="Country heatmap values">
          {worldCountries.features.map((boundary) => {
            const boundaryId = String(boundary.id).padStart(3, '0');
            const country = countryByBoundary.get(boundaryId);
            const row = country ? rowByCountry.get(country.id) : undefined;
            return (
              <path
                aria-label={country ? `${country.name}: ${row ? formatMetric(row.average) : 'No data'}` : undefined}
                aria-pressed={country ? lockedCountryId === country.id : undefined}
                className={`transportation-heatmap-country${country ? ' transportation-heatmap-country--visited' : ''}${row ? ' transportation-heatmap-country--data' : ''}`}
                d={path(boundary) ?? undefined}
                data-heatmap-country={country?.id}
                key={boundary.id ?? boundary.properties.name}
                onBlur={() => setHoveredCountryId(null)}
                onClick={() => country && setLockedCountryId((current) => current === country.id ? null : country.id)}
                onFocus={() => country && setHoveredCountryId(country.id)}
                onMouseEnter={() => country && setHoveredCountryId(country.id)}
                onMouseLeave={() => setHoveredCountryId(null)}
                onKeyDown={(event) => {
                  if (country && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    setLockedCountryId((current) => current === country.id ? null : country.id);
                  }
                }}
                role={country ? 'button' : undefined}
                style={row ? { fill: color(row.average) } : undefined}
                tabIndex={country ? 0 : undefined}
              />
            );
          })}
        </g>
        <g aria-label="Active Country border" pointerEvents="none">
          {activeCountry && worldCountries.features
            .filter((boundary) => String(boundary.id).padStart(3, '0') === activeCountry.boundaryId)
            .map((boundary) => (
              <path
                className="transportation-heatmap-border-overlay"
                d={path(boundary) ?? undefined}
                data-heatmap-border-overlay={activeCountry.id}
                key={boundary.id ?? boundary.properties.name}
              />
            ))}
        </g>
        <g aria-label="Microstate heatmap markers">
          {countries.filter(({ isMicrostate }) => isMicrostate).map((country) => {
            const point = europeProjection([country.marker.longitude, country.marker.latitude]);
            const row = rowByCountry.get(country.id);
            if (!point) return null;
            return (
              <circle
                aria-label={`${country.name}: ${row ? formatMetric(row.average) : 'No data'}`}
                aria-pressed={lockedCountryId === country.id}
                className={`transportation-heatmap-microstate${activeCountryId === country.id ? ' transportation-heatmap-microstate--active' : ''}`}
                cx={point[0]}
                cy={point[1]}
                data-testid={`heatmap-microstate-${country.id}`}
                fill={row ? color(row.average) : undefined}
                key={country.id}
                onBlur={() => setHoveredCountryId(null)}
                onClick={() => setLockedCountryId((current) => current === country.id ? null : country.id)}
                onFocus={() => setHoveredCountryId(country.id)}
                onMouseEnter={() => setHoveredCountryId(country.id)}
                onMouseLeave={() => setHoveredCountryId(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setLockedCountryId((current) => current === country.id ? null : country.id);
                  }
                }}
                r={7}
                role="button"
                tabIndex={0}
              />
            );
          })}
        </g>
      </svg>

      <div className="transportation-heatmap-legend" aria-label="Heatmap scale">
        <span>{formatMetric(0)}</span>
        <span aria-hidden="true" />
        <span>{formatMetric(scaleMaximum)}</span>
      </div>

      <div className="transportation-heatmap-details-slot">
        {activeCountry
          ? renderMetadata(activeCountry, activeRow)
          : <p>Hover over or focus a Country to inspect its transportation average.</p>}
      </div>
    </section>
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
