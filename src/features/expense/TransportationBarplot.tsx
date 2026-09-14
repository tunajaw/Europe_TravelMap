import { useState, type CSSProperties } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { CompanyIcon } from '../map/CompanyIcon.tsx';
import { TRANSPORT_COLORS } from '../map/transport-colors.ts';
import { MetadataNotes } from './MetadataNotes.tsx';
import type { TransportationBarRow, TransportationMetric } from './transportation-bar-data.ts';

export function TransportationBarplot({
  cities,
  includeAirportTransfers,
  metric,
  rows,
  segments,
  transfers,
}: {
  cities: TravelData['cities'];
  includeAirportTransfers: boolean;
  metric: TransportationMetric;
  rows: TransportationBarRow[];
  segments: TravelData['segments'];
  transfers: TravelData['transfers'];
}) {
  const [previewSegmentId, setPreviewSegmentId] = useState<string | null>(null);
  const [lockedSegmentId, setLockedSegmentId] = useState<string | null>(null);
  const cityNames = new Map(cities.map(({ id, name }) => [id, name]));
  const maximum = Math.max(0, ...rows.map(({ value }) => value));
  const activeSegmentId = previewSegmentId ?? lockedSegmentId;
  const activeRow = rows.find(({ segmentId }) => segmentId === activeSegmentId);
  const activeSegment = segments.find(({ id }) => id === activeRow?.segmentId);
  const activeRoute = activeRow
    ? `${cityNames.get(activeRow.originCityId) ?? activeRow.originCityId} to ${cityNames.get(activeRow.destinationCityId) ?? activeRow.destinationCityId}`
    : null;
  const activeTransfers = activeSegment
    ? transfers.filter(({ segmentId }) => segmentId === activeSegment.id)
    : [];

  function transferDetails(side: 'departure' | 'arrival') {
    const transfer = activeTransfers.find((candidate) => candidate.side === side);
    const heading = side === 'departure' ? 'Departure Transfer' : 'Arrival Transfer';

    return (
      <section className="transportation-bar-detail-card">
        <h4>{heading}</h4>
        {transfer ? (
          <dl>
            <div><dt>Cost</dt><dd>EUR {transfer.costEur.toFixed(2)}</dd></div>
            <div>
              <dt>Type</dt>
              <dd>{transfer.endpointKind === 'airport' ? 'Airport transfer' : 'Local transfer'}</dd>
            </div>
            {transfer.localRoute && (
              <div>
                <dt>Route</dt>
                <dd>{transfer.localRoute.start.name} → {transfer.localRoute.end.name}</dd>
              </div>
            )}
            <div><dt>Company / mode details</dt><dd><MetadataNotes notes={transfer.notes} /></dd></div>
            <div>
              <dt>Expense status</dt>
              <dd>
                {transfer.expenseInclusion === 'always' || includeAirportTransfers
                  ? 'Included in current value'
                  : 'Excluded by current filter'}
              </dd>
            </div>
          </dl>
        ) : <p>Not recorded</p>}
      </section>
    );
  }

  return (
    <section className="transportation-chart" aria-labelledby="transportation-chart-heading">
      <div className="transportation-chart-heading">
        <div>
          <p className="eyebrow">Segment comparison</p>
          <h3 id="transportation-chart-heading">Transportation barplot</h3>
        </div>
        <p>{rows.length} Segments</p>
      </div>

      {rows.length ? (
        <ol className="transportation-bars-list" aria-label="Transportation barplot">
          {rows.map((row, index) => {
            const route = `${cityNames.get(row.originCityId) ?? row.originCityId} → ${cityNames.get(row.destinationCityId) ?? row.destinationCityId}`;
            const valueLabel = metric === 'total-cost'
              ? `EUR ${row.value.toFixed(2)}`
              : `EUR ${row.value.toFixed(2)} / 100 km`;
            return (
              <li
                aria-label={`${cityNames.get(row.originCityId) ?? row.originCityId} to ${cityNames.get(row.destinationCityId) ?? row.destinationCityId}, ${row.date}, ${valueLabel}`}
                className="transportation-bar-item"
                key={row.segmentId}
                onMouseEnter={() => setPreviewSegmentId(row.segmentId)}
                onMouseLeave={() => setPreviewSegmentId((current) => current === row.segmentId ? null : current)}
                style={{ '--bar-delay': `${Math.min(index * 18, 240)}ms` } as CSSProperties}
              >
                <button
                  aria-label={`Select ${cityNames.get(row.originCityId) ?? row.originCityId} to ${cityNames.get(row.destinationCityId) ?? row.destinationCityId}, ${row.date}, ${valueLabel}`}
                  aria-pressed={lockedSegmentId === row.segmentId}
                  className="transportation-bar-row"
                  onBlur={() => setPreviewSegmentId((current) => current === row.segmentId ? null : current)}
                  onClick={() => setLockedSegmentId((current) => current === row.segmentId ? null : row.segmentId)}
                  onFocus={() => setPreviewSegmentId(row.segmentId)}
                  type="button"
                >
                  <span className="transportation-bar-copy">
                    <strong>{route}</strong>
                    <span>{row.date}</span>
                  </span>
                  <span className="transportation-bar-track">
                    <span
                      className="transportation-bar-fill"
                      style={{
                        '--bar-color': TRANSPORT_COLORS[row.category],
                        width: maximum === 0 ? '0%' : `${row.value / maximum * 100}%`,
                      } as CSSProperties}
                    />
                  </span>
                  <output>{valueLabel}</output>
                </button>
              </li>
            );
          })}
        </ol>
      ) : <p className="transportation-chart-empty">No Segments match the current filters.</p>}

      <div className="transportation-bar-details-slot">
        {activeSegment && activeRoute ? (
          <section
            aria-label={`${activeRoute} details`}
            className="transportation-bar-details"
            key={activeSegment.id}
            role="region"
          >
            <div className="transportation-bar-details-heading">
              <p className="eyebrow">Selected Segment</p>
              <h3>{activeRoute}</h3>
            </div>
            <div className="transportation-bar-detail-grid">
              <section className="transportation-bar-detail-card">
                <h4>Base Segment</h4>
                <dl>
                  <div><dt>Fare</dt><dd>EUR {activeSegment.baseCostEur.toFixed(2)}</dd></div>
                  <div>
                    <dt>Company</dt>
                    <dd className="transportation-bar-company">
                      {activeSegment.company ?? 'Not recorded'}
                      <CompanyIcon
                        category={activeSegment.transportationCategory}
                        company={activeSegment.company}
                      />
                    </dd>
                  </div>
                  <div><dt>Notes</dt><dd><MetadataNotes notes={activeSegment.notes} /></dd></div>
                </dl>
              </section>
              {transferDetails('departure')}
              {transferDetails('arrival')}
            </div>
          </section>
        ) : (
          <p className="transportation-bar-details-placeholder">
            Hover over or focus a Segment bar to inspect its fare and transfers.
          </p>
        )}
      </div>
    </section>
  );
}
