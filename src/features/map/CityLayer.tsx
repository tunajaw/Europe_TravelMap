import { geoMercator } from 'd3-geo';
import { useMemo, useState } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { europeProjection, layoutCountryLabels, MAP_WIDTH } from './country-label-layout.ts';

export function CityLayer({ cities, viewport }: {
  cities: TravelData['cities']; viewport: [number, number, number, number];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const scale = viewport[2] / MAP_WIDTH;
  const labels = useMemo(() => {
    const [translateX, translateY] = europeProjection.translate();
    const projection = geoMercator().center(europeProjection.center())
      .scale(europeProjection.scale() / scale)
      .translate([(translateX - viewport[0]) / scale, (translateY - viewport[1]) / scale]);
    return layoutCountryLabels(cities.map((city) => ({ id: city.id, name: city.name, marker: city.location })), projection);
  }, [cities, viewport[0], viewport[1], scale]);
  const names = new Map(cities.map((city) => [city.id, city.name]));
  return <g role="group" aria-label="Visited Cities" transform={`translate(${viewport[0]} ${viewport[1]}) scale(${scale})`}>
    {labels.map((label) => <g key={label.countryId} role="img" tabIndex={0} aria-label={names.get(label.countryId)}
      className={`city-marker${label.countryId === activeId ? ' city-marker--active' : ''}`}
      data-city-id={label.countryId}
      onMouseEnter={() => setActiveId(label.countryId)} onMouseLeave={() => setActiveId(null)}
      onFocus={() => setActiveId(label.countryId)} onBlur={() => setActiveId(null)}>
      <circle className="city-marker-hit" cx={label.markerX} cy={label.markerY} r={activeId === label.countryId ? 24 : 18} />
      {label.showLeader && <line className="city-marker-leader" x1={label.markerX} y1={label.markerY} x2={label.labelX} y2={label.labelY} />}
      <circle data-testid="city-marker" cx={label.markerX} cy={label.markerY} r={activeId === label.countryId ? 6 : 4.5} />
      <text x={label.labelX} y={label.labelY} textAnchor="middle" dominantBaseline="middle">{names.get(label.countryId)}</text>
    </g>)}
  </g>;
}
