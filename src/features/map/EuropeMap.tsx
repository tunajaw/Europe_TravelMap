import { geoGraticule10, geoPath } from 'd3-geo';
import { useId, useMemo } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  europeProjection,
  layoutCountryLabels,
} from './country-label-layout.ts';
import { worldCountries } from './world-geography.ts';
import { countryViewport } from './country-viewport.ts';
import { CityLayer } from './CityLayer.tsx';
import { SegmentLayer } from './SegmentLayer.tsx';
import { buildSegmentRoutes } from './segment-geometry.ts';
import { useViewportTransition } from './use-viewport-transition.ts';
import './europe-map.css';

type Country = TravelData['countries'][number];

const path = geoPath(europeProjection);

interface EuropeMapProps {
  countries: Country[];
  cities?: TravelData['cities'];
  segments?: TravelData['segments'];
  showRoutes?: boolean;
  domesticOnly?: boolean;
  selectedId?: string | null;
  hoveredId?: string | null;
  focusedId?: string | null;
  onSelect?: (id: string) => void;
  onEnter?: (id: string) => void;
  onHover?: (id: string | null) => void;
}

export function EuropeMap({ countries, cities = [], segments = [], showRoutes = true, domesticOnly = false, selectedId, hoveredId, focusedId, onSelect, onEnter, onHover }: EuropeMapProps) {
  const shadowId = useId();
  const focused = countries.find((country) => country.id === focusedId);
  const visibleSegments = useMemo(() => focused && domesticOnly
    ? segments.filter((segment) => segment.originCountryId === focused.id && segment.destinationCountryId === focused.id)
    : segments, [segments, focused, domesticOnly]);
  const visibleCities = useMemo(() => {
    if (!focused) return [];
    const own = new Set(cities.filter((city) => city.countryId === focused.id).map((city) => city.id));
    const connected = new Set(visibleSegments.filter((segment) => segment.pathCityIds.some((id) => own.has(id))).flatMap((segment) => segment.pathCityIds));
    return cities.filter((city) => own.has(city.id) || connected.has(city.id));
  }, [cities, visibleSegments, focused]);
  const viewport = countryViewport(focused, visibleCities);
  const displayedViewport = useViewportTransition(viewport);
  const markerScale = viewport[2] / MAP_WIDTH;
  const routes = useMemo(() => buildSegmentRoutes({ countries, cities, segments: visibleSegments }, focusedId ?? null, markerScale), [countries, cities, visibleSegments, focusedId, markerScale]);
  const countryByBoundary = new Map(countries.map((country) => [country.boundaryId, country]));
  const labelByCountry = new Map(
    layoutCountryLabels(countries, europeProjection).map((placement) => [placement.countryId, placement]),
  );

  return (
    <svg
      aria-label={focused ? `${focused.name} country map` : 'Europe travel map'}
      className="europe-map"
      role={onSelect ? 'group' : 'img'}
      viewBox={displayedViewport.join(' ')}
    >
      <defs>
        <filter id={shadowId} x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2" />
        </filter>
      </defs>
      <path className="map-sphere" d={path({ type: 'Sphere' }) ?? undefined} />
      <path className="map-graticule" d={path(geoGraticule10()) ?? undefined} />
      <g aria-label="Country boundaries">
        {worldCountries.features.map((boundary) => {
          const boundaryId = String(boundary.id).padStart(3, '0');
          const country = countryByBoundary.get(boundaryId);
          return (
            <path
              className={`country-boundary${country ? ' country-boundary--visited' : ''}${country && (country.id === hoveredId || country.id === selectedId) ? ' country-boundary--active' : ''}`}
              d={path(boundary) ?? undefined}
              data-boundary-country={country?.id}
              key={boundary.id ?? boundary.properties.name}
            />
          );
        })}
      </g>
      <g aria-label="Highlighted country borders" pointerEvents="none">
        {worldCountries.features.filter((boundary) => {
          const country = countryByBoundary.get(String(boundary.id).padStart(3, '0'));
          return country && (country.id === selectedId || country.id === hoveredId);
        }).map((boundary) => <path key={boundary.id ?? boundary.properties.name} className="country-border-overlay"
          d={path(boundary) ?? undefined} />)}
      </g>
      {focused && <text className="country-map-name" x={viewport[0] + viewport[2] / 2} y={viewport[1] + viewport[3] / 2}
        textAnchor="middle" dominantBaseline="middle" fontSize={viewport[2] * 0.09} pointerEvents="none">{focused.name}</text>}
      {showRoutes && <SegmentLayer key={`routes-${focusedId ?? 'europe'}-${domesticOnly}`} routes={routes} />}
      <g aria-label="Visited Countries">
        {countries.map((country) => {
          if (focused) return null;
          const placement = labelByCountry.get(country.id);
          if (!placement) return null;
          return (
            <g className={`country-marker${country.id === hoveredId || country.id === selectedId ? ' country-marker--active' : ''}`} key={country.id}
              transform={`translate(${placement.markerX} ${placement.markerY}) scale(${markerScale}) translate(${-placement.markerX} ${-placement.markerY})`}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={onSelect ? `Select ${country.name}` : undefined}
              aria-pressed={onSelect ? selectedId === country.id : undefined}
              data-country-id={country.id}
              onMouseEnter={() => onHover?.(country.id)} onMouseLeave={() => onHover?.(null)}
              onFocus={() => onHover?.(country.id)} onBlur={() => onHover?.(null)}
              onClick={(event) => { if (onSelect) { event.stopPropagation(); onSelect(country.id); } }}
              onDoubleClick={(event) => { if (onEnter) { event.stopPropagation(); onEnter(country.id); } }}
              onKeyDown={(event) => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(country.id); } }}>
              {onSelect && <circle className="country-marker__hit" cx={placement.markerX} cy={placement.markerY}
                r={hoveredId === country.id ? 40 : 32} />}
              {placement.showLeader ? (
                <line
                  className="country-marker__leader"
                  x1={placement.markerX}
                  x2={placement.labelX}
                  y1={placement.markerY}
                  y2={placement.labelY}
                />
              ) : null}
              <circle
                cx={placement.markerX}
                cy={placement.markerY}
                data-testid="country-marker"
                filter={`url(#${shadowId})`}
                r={(country.isMicrostate ? 5.5 : 4.5) * (country.id === hoveredId || country.id === selectedId ? 1.25 : 1)}
              />
              <text
                dominantBaseline="middle"
                textAnchor="middle"
                x={placement.labelX}
                y={placement.labelY}
              >
                {country.name}
              </text>
            </g>
          );
        })}
      </g>
      {focused && <CityLayer key={`cities-${focused.id}`} cities={visibleCities} viewport={viewport} />}
    </svg>
  );
}
