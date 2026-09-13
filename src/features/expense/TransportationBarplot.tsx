import type { CSSProperties } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { TRANSPORT_COLORS } from '../map/transport-colors.ts';
import type { TransportationBarRow, TransportationMetric } from './transportation-bar-data.ts';

export function TransportationBarplot({
  cities,
  metric,
  rows,
}: {
  cities: TravelData['cities'];
  metric: TransportationMetric;
  rows: TransportationBarRow[];
}) {
  const cityNames = new Map(cities.map(({ id, name }) => [id, name]));
  const maximum = Math.max(0, ...rows.map(({ value }) => value));

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
          {rows.map((row) => {
            const route = `${cityNames.get(row.originCityId) ?? row.originCityId} → ${cityNames.get(row.destinationCityId) ?? row.destinationCityId}`;
            const valueLabel = metric === 'total-cost'
              ? `EUR ${row.value.toFixed(2)}`
              : `EUR ${row.value.toFixed(2)} / 100 km`;
            return (
              <li className="transportation-bar-row" key={row.segmentId}>
                <div className="transportation-bar-copy">
                  <strong>{route}</strong>
                  <span>{row.date}</span>
                </div>
                <div className="transportation-bar-track">
                  <span
                    className="transportation-bar-fill"
                    style={{
                      '--bar-color': TRANSPORT_COLORS[row.category],
                      width: maximum === 0 ? '0%' : `${row.value / maximum * 100}%`,
                    } as CSSProperties}
                  />
                </div>
                <output>{valueLabel}</output>
              </li>
            );
          })}
        </ol>
      ) : <p className="transportation-chart-empty">No Segments match the current filters.</p>}
    </section>
  );
}
