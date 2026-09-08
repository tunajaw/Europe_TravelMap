import { geoGraticule10, geoPath } from 'd3-geo';
import { useId } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  europeProjection,
  layoutCountryLabels,
} from './country-label-layout.ts';
import { worldCountries } from './world-geography.ts';
import { countryViewport } from './country-viewport.ts';
import './europe-map.css';

type Country = TravelData['countries'][number];

const path = geoPath(europeProjection);

interface EuropeMapProps {
  countries: Country[];
  selectedId?: string | null;
  hoveredId?: string | null;
  focusedId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
}

export function EuropeMap({ countries, selectedId, hoveredId, focusedId, onSelect, onHover }: EuropeMapProps) {
  const shadowId = useId();
  const focused = countries.find((country) => country.id === focusedId);
  const viewport = countryViewport(focused);
  const markerScale = viewport[2] / MAP_WIDTH;
  const countryByBoundary = new Map(countries.map((country) => [country.boundaryId, country]));
  const labelByCountry = new Map(
    layoutCountryLabels(countries, europeProjection).map((placement) => [placement.countryId, placement]),
  );

  return (
    <svg
      aria-label={focused ? `${focused.name} country map` : 'Europe travel map'}
      className="europe-map"
      role={onSelect ? 'group' : 'img'}
      viewBox={viewport.join(' ')}
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
              key={boundaryId}
            />
          );
        })}
      </g>
      <g aria-label="Highlighted country borders" pointerEvents="none">
        {worldCountries.features.filter((boundary) => {
          const country = countryByBoundary.get(String(boundary.id).padStart(3, '0'));
          return country && (country.id === selectedId || country.id === hoveredId);
        }).map((boundary) => <path key={String(boundary.id)} className="country-border-overlay"
          d={path(boundary) ?? undefined} />)}
      </g>
      <g aria-label="Visited Countries">
        {countries.map((country) => {
          if (focused && country.id !== focused.id) return null;
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
    </svg>
  );
}
