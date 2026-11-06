import type { TravelData } from '../../domain/travel-data.ts';
import {
  cityReviewProgress,
  countryReviewProgress,
  poiReviewSummary,
  type PoiReviewMap,
} from './poi-review-store.ts';

const percent = (value: number, total: number): string =>
  `${total === 0 ? '0.0' : (value / total * 100).toFixed(1)}%`;

export function CountryReviewProgress({ data, reviews, onEnter }: {
  data: TravelData;
  reviews: PoiReviewMap;
  onEnter: (countryId: string) => void;
}) {
  const summary = poiReviewSummary(data.pois ?? [], reviews);
  return <nav className="poi-progress-sidebar" aria-label="Country POI review progress">
    <div className="poi-progress-heading"><p className="eyebrow">Temporary QA</p><h3>Countries</h3></div>
    <section className="poi-review-summary" aria-label="Overall POI review summary">
      <h4>POI review summary</h4>
      <dl>
        <div><dt>Total POIs</dt><dd><strong>{summary.total}</strong></dd></div>
        <div><dt>Reviewed</dt><dd><strong>{summary.reviewed}</strong><span>{percent(summary.reviewed, summary.total)} of all</span></dd></div>
        <div><dt>Accepted</dt><dd><strong>{summary.accepted}</strong><span>{percent(summary.accepted, summary.total)} of all · {percent(summary.accepted, summary.reviewed)} of reviewed</span></dd></div>
        <div><dt>Rejected</dt><dd><strong>{summary.rejected}</strong><span>{percent(summary.rejected, summary.total)} of all · {percent(summary.rejected, summary.reviewed)} of reviewed</span></dd></div>
      </dl>
    </section>
    <div className="poi-progress-list">{data.countries.map((country) => {
      const progress = countryReviewProgress(country.id, data, reviews);
      return <button key={country.id} type="button"
        className={`poi-progress-item${progress.complete ? ' poi-progress-item--complete' : ''}`}
        aria-label={`${country.name}. Cities ${progress.reviewedCities} of ${progress.totalCities}. POIs ${progress.reviewedPois} of ${progress.totalPois}`}
        onClick={() => onEnter(country.id)}>
        <strong>{country.name}</strong>
        <span>Cities: {progress.reviewedCities} / {progress.totalCities}</span>
        <span>POIs: {progress.reviewedPois} / {progress.totalPois}</span>
      </button>;
    })}</div>
  </nav>;
}

export function CityReviewProgress({ countryId, data, reviews, onEnter }: {
  countryId: string;
  data: TravelData;
  reviews: PoiReviewMap;
  onEnter: (cityId: string) => void;
}) {
  const cities = data.cities.filter((city) => city.countryId === countryId);
  return <nav className="poi-progress-sidebar" aria-label="City POI review progress">
    <div className="poi-progress-heading"><p className="eyebrow">Temporary QA</p><h3>Cities</h3></div>
    <div className="poi-progress-list">{cities.map((city) => {
      const progress = cityReviewProgress(city.id, data.pois ?? [], reviews);
      return <button key={city.id} type="button"
        className={`poi-progress-item${progress.complete ? ' poi-progress-item--complete' : ''}`}
        aria-label={`${city.name}. ${progress.reviewed} of ${progress.total} POIs reviewed`}
        onClick={() => onEnter(city.id)}>
        <strong>{city.name}</strong><span>{progress.reviewed} / {progress.total}</span>
      </button>;
    })}</div>
  </nav>;
}
