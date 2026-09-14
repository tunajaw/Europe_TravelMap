import { type CSSProperties } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { accommodationRatingRubric, ratingCellCounts } from './accommodation-rating.ts';

type Accommodation = TravelData['accommodations'][number];

export function AccommodationRating({ rating, type }: Pick<Accommodation, 'rating' | 'type'>) {
  const rubric = accommodationRatingRubric(type);
  const starPercentage = `${Math.max(0, Math.min(100, rating.total / 5 * 100))}%`;

  return <section className="accommodation-rating" aria-label="Personal rating breakdown">
    <div className="accommodation-rating-total">
      <span className="accommodation-rating-stars" aria-hidden="true">
        <span>★★★★★</span>
        <span className="accommodation-rating-stars-fill" style={{ '--star-width': starPercentage } as CSSProperties}>★★★★★</span>
      </span>
      <strong>{rating.total.toFixed(2)} / 5 stars</strong>
    </div>
    <ul className="accommodation-rating-components">
      {rubric.map((dimension, index) => {
        const value = rating.components[index] ?? 0;
        const cells = ratingCellCounts(value, dimension);
        return <li key={dimension.label}>
          <span className="accommodation-rating-label">{dimension.label}</span>
          <span
            aria-label={`${dimension.label}: ${value} (${dimension.minimum} to ${dimension.maximum})`}
            className={`accommodation-rating-meter${cells.negativeTotal ? ' accommodation-rating-meter--bipolar' : ''}`}
          >
            {Array.from({ length: cells.negativeTotal }, (_, cellIndex) => (
              <span className={cellIndex >= cells.negativeTotal - cells.negativeFilled ? 'is-negative-filled' : ''}
                key={`negative-${cellIndex}`} />
            ))}
            {cells.negativeTotal > 0 && <i aria-hidden="true" />}
            {Array.from({ length: cells.positiveTotal }, (_, cellIndex) => (
              <span className={cellIndex < cells.positiveFilled ? 'is-positive-filled' : ''}
                key={`positive-${cellIndex}`} />
            ))}
          </span>
          <output>{formatScore(value)}</output>
        </li>;
      })}
    </ul>
  </section>;
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}
