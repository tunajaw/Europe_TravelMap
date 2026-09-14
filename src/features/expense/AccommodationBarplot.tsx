import { useState, type CSSProperties } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { AccommodationRating } from './AccommodationRating.tsx';
import { MetadataNotes } from './MetadataNotes.tsx';
import {
  ACCOMMODATION_COLORS,
  type AccommodationBarRow,
  type AccommodationMetric,
} from './accommodation-data.ts';

export function AccommodationBarplot({
  cities,
  metric,
  rows,
}: {
  cities: TravelData['cities'];
  metric: AccommodationMetric;
  rows: AccommodationBarRow[];
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [lockedId, setLockedId] = useState<string | null>(null);
  const activeId = previewId ?? lockedId;
  const active = rows.find(({ accommodationId }) => accommodationId === activeId);
  const cityNames = new Map(cities.map(({ id, name }) => [id, name]));
  const maximum = Math.max(0, ...rows.map(({ value }) => value));

  const formatValue = (value: number) => metric === 'nightly-price'
    ? `EUR ${value.toFixed(2)} / night`
    : `${value.toFixed(0)} min`;

  return (
    <section className="accommodation-chart" aria-labelledby="accommodation-chart-heading">
      <div className="accommodation-chart-heading">
        <div>
          <p className="eyebrow">Accommodation comparison</p>
          <h3 id="accommodation-chart-heading">Accommodation barplot</h3>
        </div>
        <p>{rows.length} Accommodations</p>
      </div>

      {rows.length ? (
        <ol className="accommodation-bars-list" aria-label="Accommodation barplot">
          {rows.map((row, index) => {
            const cityName = cityNames.get(row.cityId) ?? row.cityId;
            const label = `${cityName} · ${row.type}`;
            return (
              <li
                className="accommodation-bar-item"
                key={row.accommodationId}
                onMouseEnter={() => setPreviewId(row.accommodationId)}
                onMouseLeave={() => setPreviewId(null)}
                style={{ '--bar-delay': `${Math.min(index * 18, 240)}ms` } as CSSProperties}
              >
                <button
                  aria-label={`Select ${label}, ${formatValue(row.value)}`}
                  aria-pressed={lockedId === row.accommodationId}
                  className="accommodation-bar-row"
                  onBlur={() => setPreviewId(null)}
                  onClick={() => setLockedId((current) => current === row.accommodationId ? null : row.accommodationId)}
                  onFocus={() => setPreviewId(row.accommodationId)}
                  type="button"
                >
                  <span className="accommodation-bar-copy"><strong>{label}</strong><span>{row.nights} nights</span></span>
                  <span className="accommodation-bar-track">
                    <span
                      className="accommodation-bar-fill"
                      style={{
                        backgroundColor: ACCOMMODATION_COLORS[row.type],
                        minWidth: row.type === 'Airport' ? '8px' : row.value > 0 ? '4px' : 0,
                        width: maximum === 0 ? '0%' : `${row.value / maximum * 100}%`,
                      } as CSSProperties}
                    />
                  </span>
                  <output>{formatValue(row.value)}</output>
                </button>
              </li>
            );
          })}
        </ol>
      ) : <p className="accommodation-chart-empty">No Accommodations match the current filters.</p>}

      <div className="accommodation-details-slot">
        {active ? (
          <section
            aria-label={`${cityNames.get(active.cityId) ?? active.cityId} ${active.type} details`}
            className="accommodation-details"
            key={active.accommodationId}
            role="region"
          >
            <div><p className="eyebrow">Selected Accommodation</p><h3>{active.label}</h3></div>
            <dl>
              <div>
                <dt>{metric === 'nightly-price' ? 'Commute' : 'Nightly price'}</dt>
                <dd>{metric === 'nightly-price'
                  ? active.commuteMinutes === null ? 'Not applicable' : `${active.commuteMinutes} min`
                  : `EUR ${active.pricePerNightEur.toFixed(2)} / night`}</dd>
              </div>
              <div><dt>Nearest station</dt><dd>{active.nearestStationName ?? '-'}</dd></div>
              <div className="accommodation-rating-detail"><dt>Personal rating</dt><dd><AccommodationRating rating={active.rating} type={active.type} /></dd></div>
              <div><dt>Notes</dt><dd><MetadataNotes notes={active.notes} /></dd></div>
            </dl>
          </section>
        ) : <p>Hover over or focus an Accommodation bar to inspect its details. Click to lock it.</p>}
      </div>
    </section>
  );
}
