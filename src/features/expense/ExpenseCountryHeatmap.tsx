import { geoPath } from 'd3-geo';
import { scaleLinear } from 'd3-scale';
import { useState, type KeyboardEvent, type WheelEvent } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { MAP_HEIGHT, MAP_WIDTH, europeProjection } from '../map/country-label-layout.ts';
import { worldCountries } from '../map/world-geography.ts';

const path = geoPath(europeProjection);
type ViewBox = [number, number, number, number];

export interface ExpenseHeatmapDatum {
  countryId: string; count: number; average: number; standardDeviation: number; rank: number;
}

export function ExpenseCountryHeatmap({ ariaLabel, countLabel, countries, data, eyebrow, formatMetric, heading, prompt, scaleMaximum }: {
  ariaLabel: string; countLabel: string; countries: TravelData['countries']; data: ExpenseHeatmapDatum[];
  eyebrow: string; formatMetric: (value: number) => string; heading: string; prompt: string; scaleMaximum: number;
}) {
  const [hoveredCountryId, setHoveredCountryId] = useState<string | null>(null);
  const [lockedCountryId, setLockedCountryId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState<ViewBox>([0, 0, MAP_WIDTH, MAP_HEIGHT]);
  const activeCountryId = hoveredCountryId ?? lockedCountryId;
  const activeCountry = countries.find(({ id }) => id === activeCountryId);
  const datumByCountry = new Map(data.map((datum) => [datum.countryId, datum]));
  const activeDatum = activeCountry ? datumByCountry.get(activeCountry.id) : undefined;
  const countryByBoundary = new Map(countries.map((country) => [country.boundaryId, country]));
  const color = scaleLinear<string>().domain([0, Math.max(scaleMaximum, 1)]).range(['#b8d9ee', '#173f6d']).clamp(true);
  const toggleCountry = (countryId: string) => setLockedCountryId((current) => current === countryId ? null : countryId);

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    if (event.deltaY === 0) return;
    const [x, y, width, height] = viewBox;
    const nextWidth = Math.min(MAP_WIDTH, Math.max(MAP_WIDTH / 4, width * (event.deltaY < 0 ? 0.82 : 1.22)));
    if (nextWidth === width) return;
    event.preventDefault();
    const nextHeight = nextWidth * MAP_HEIGHT / MAP_WIDTH;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratioX = bounds.width > 0 ? clamp((event.clientX - bounds.left) / bounds.width, 0, 1) : 0.5;
    const ratioY = bounds.height > 0 ? clamp((event.clientY - bounds.top) / bounds.height, 0, 1) : 0.5;
    setViewBox([
      clamp(x + ratioX * (width - nextWidth), 0, MAP_WIDTH - nextWidth),
      clamp(y + ratioY * (height - nextHeight), 0, MAP_HEIGHT - nextHeight), nextWidth, nextHeight,
    ]);
  }

  const keyboardToggle = (event: KeyboardEvent, countryId: string) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleCountry(countryId); }
  };

  return <section className="transportation-heatmap" aria-label={heading}>
    <div className="transportation-heatmap-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{heading}</h3></div>
      <button disabled={viewBox[2] === MAP_WIDTH} onClick={() => setViewBox([0, 0, MAP_WIDTH, MAP_HEIGHT])} type="button">Reset zoom</button></div>
    <svg aria-label={ariaLabel} className="transportation-heatmap-map" onMouseLeave={() => setHoveredCountryId(null)}
      onWheel={handleWheel} role="group" viewBox={viewBox.join(' ')}>
      <rect className="transportation-heatmap-sea" height={MAP_HEIGHT} width={MAP_WIDTH} />
      <g aria-label="Country heatmap values">{worldCountries.features.map((boundary) => {
        const country = countryByBoundary.get(String(boundary.id).padStart(3, '0'));
        const datum = country ? datumByCountry.get(country.id) : undefined;
        return <path aria-label={country ? `${country.name}: ${datum ? formatMetric(datum.average) : 'No data'}` : undefined}
          aria-pressed={country ? lockedCountryId === country.id : undefined}
          className={`transportation-heatmap-country${country ? ' transportation-heatmap-country--visited' : ''}${datum ? ' transportation-heatmap-country--data' : ''}`}
          d={path(boundary) ?? undefined} data-heatmap-country={country?.id} key={boundary.id ?? boundary.properties.name}
          onBlur={() => setHoveredCountryId(null)} onClick={() => country && toggleCountry(country.id)}
          onFocus={() => country && setHoveredCountryId(country.id)} onKeyDown={(event) => country && keyboardToggle(event, country.id)}
          onMouseEnter={() => country && setHoveredCountryId(country.id)} onMouseLeave={() => setHoveredCountryId(null)}
          role={country ? 'button' : undefined} style={datum ? { fill: color(datum.average) } : undefined} tabIndex={country ? 0 : undefined} />;
      })}</g>
      <g aria-label="Active Country border" pointerEvents="none">{activeCountry && worldCountries.features
        .filter((boundary) => String(boundary.id).padStart(3, '0') === activeCountry.boundaryId)
        .map((boundary) => <path className="transportation-heatmap-border-overlay" d={path(boundary) ?? undefined}
          data-heatmap-border-overlay={activeCountry.id} key={boundary.id ?? boundary.properties.name} />)}</g>
      <g aria-label="Microstate heatmap markers">{countries.filter(({ isMicrostate }) => isMicrostate).map((country) => {
        const point = europeProjection([country.marker.longitude, country.marker.latitude]);
        const datum = datumByCountry.get(country.id);
        if (!point) return null;
        return <circle aria-label={`${country.name}: ${datum ? formatMetric(datum.average) : 'No data'}`}
          aria-pressed={lockedCountryId === country.id}
          className={`transportation-heatmap-microstate${activeCountryId === country.id ? ' transportation-heatmap-microstate--active' : ''}`}
          cx={point[0]} cy={point[1]} data-testid={`heatmap-microstate-${country.id}`}
          key={country.id} onBlur={() => setHoveredCountryId(null)} onClick={() => toggleCountry(country.id)}
          onFocus={() => setHoveredCountryId(country.id)} onKeyDown={(event) => keyboardToggle(event, country.id)}
          onMouseEnter={() => setHoveredCountryId(country.id)} onMouseLeave={() => setHoveredCountryId(null)} r={7} role="button"
          style={datum ? { fill: color(datum.average) } : undefined} tabIndex={0} />;
      })}</g>
    </svg>
    <div className="transportation-heatmap-legend" aria-label="Heatmap scale"><span>{formatMetric(0)}</span><span aria-hidden="true" /><span>{formatMetric(scaleMaximum)}</span></div>
    <div className="transportation-heatmap-details-slot">{activeCountry ?
      <section aria-label={`${activeCountry.name} heatmap details`} className="transportation-heatmap-details" key={activeCountry.id} role="region">
        <h4>{activeCountry.name}</h4><dl><div><dt>{countLabel}</dt><dd>{activeDatum?.count ?? 0}</dd></div>
          <div><dt>Average ± standard deviation</dt><dd>{activeDatum ? `${formatMetric(activeDatum.average)} ± ${formatMetric(activeDatum.standardDeviation)}` : 'No data'}</dd></div>
          <div><dt>Rank</dt><dd>{activeDatum ? `#${activeDatum.rank}` : 'Not ranked'}</dd></div></dl></section> : <p>{prompt}</p>}</div>
  </section>;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
