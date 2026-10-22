import type { TravelData } from '../../domain/travel-data.ts';
import { cityReviewProgress, countryReviewProgress, type PoiReviewMap } from './poi-review-store.ts';

export function CountryReviewProgress({ data, reviews, onEnter }: {
  data: TravelData;
  reviews: PoiReviewMap;
  onEnter: (countryId: string) => void;
}) {
  return <nav className="poi-progress-sidebar" aria-label="Country POI review progress">
    <div className="poi-progress-heading"><p className="eyebrow">Temporary QA</p><h3>Countries</h3></div>
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
