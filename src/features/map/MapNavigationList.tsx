import type { TravelData } from '../../domain/travel-data.ts';
import { googleMapsPoiUrl } from './poi-map-link.ts';

type Poi = NonNullable<TravelData['pois']>[number];

export function CountryList({ data, onEnter }: {
  data: TravelData;
  onEnter: (countryId: string) => void;
}) {
  return <nav className="poi-progress-sidebar" aria-label="Country list">
    <div className="poi-progress-heading"><p className="eyebrow">Browse the map</p><h3>Countries</h3></div>
    <div className="poi-progress-list">{data.countries.map((country) => {
      const cities = data.cities.filter(({ countryId }) => countryId === country.id);
      const cityIds = new Set(cities.map(({ id }) => id));
      const poiCount = (data.pois ?? []).filter(({ cityId }) => cityIds.has(cityId)).length;
      return <button className="poi-progress-item" key={country.id} type="button"
        aria-label={`Open ${country.name}. ${cities.length} cities and ${poiCount} POIs`}
        onClick={() => onEnter(country.id)}>
        <strong>{country.name}</strong><span>{cities.length} cities · {poiCount} POIs</span>
      </button>;
    })}</div>
  </nav>;
}

export function CityList({ countryId, data, onEnter }: {
  countryId: string;
  data: TravelData;
  onEnter: (cityId: string) => void;
}) {
  const cities = data.cities.filter((city) => city.countryId === countryId);
  return <nav className="poi-progress-sidebar" aria-label="City list">
    <div className="poi-progress-heading"><p className="eyebrow">Explore the country</p><h3>Cities</h3></div>
    <div className="poi-progress-list">{cities.map((city) => {
      const poiCount = (data.pois ?? []).filter(({ cityId }) => cityId === city.id).length;
      return <button className="poi-progress-item" key={city.id} type="button"
        aria-label={`Open ${city.name}. ${poiCount} POIs`}
        onClick={() => onEnter(city.id)}>
        <strong>{city.name}</strong><span>{poiCount} POIs</span>
      </button>;
    })}</div>
  </nav>;
}

export function CityPoiList({ cityName, pois, onFocus }: {
  cityName: string;
  pois: Poi[];
  onFocus: (poiId: string) => void;
}) {
  return <nav className="city-poi-dashboard" aria-label="POI list">
    <div className="city-poi-dashboard-heading">
      <p className="eyebrow">Explore {cityName}</p>
      <h2>Places</h2>
      <p>{pois.length} reviewed POIs</p>
    </div>
    <div className="city-poi-dashboard-list">{pois.map((poi) => <div
      className={`city-poi-dashboard-item city-poi-dashboard-item--${poi.category.toLowerCase()}`} key={poi.id}>
      <button type="button" aria-label={`Focus ${poi.name}`} onClick={() => onFocus(poi.id)}>
        <span>{poi.name}</span><small>{poi.category}</small>
      </button>
      <a href={googleMapsPoiUrl(poi)} target="_blank" rel="noreferrer"
        aria-label={`Open ${poi.name} in Google Maps`}>↗</a>
    </div>)}</div>
    {pois.length === 0 && <p className="city-poi-dashboard-empty">No reviewed places yet.</p>}
  </nav>;
}
