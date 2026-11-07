import { useEffect, useReducer, useRef, useState } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { EuropeMap } from './EuropeMap.tsx';
import { CityAttractionMap, type CityPoiFocusRequest } from './CityAttractionMap.tsx';
import { CountryPhoto } from './CountryPhoto.tsx';
import { CityList, CityPoiList, CountryList } from './MapNavigationList.tsx';
import { TRANSPORT_MODES } from './transport-colors.ts';
import './country-explorer.css';

type Navigation = { selectedId: string | null; focusedId: string | null; cityId: string | null };
type Action = { type: 'select'; id: string }
  | { type: 'enter'; id?: string }
  | { type: 'enter-city'; id: string; countryId: string }
  | { type: 'leave-city' }
  | { type: 'clear' }
  | { type: 'restore'; state: Navigation };
function reducer(state: Navigation, action: Action): Navigation {
  switch (action.type) {
    case 'select': return { selectedId: action.id, focusedId: null, cityId: null };
    case 'enter': return { selectedId: action.id ?? state.selectedId, focusedId: action.id ?? state.selectedId, cityId: null };
    case 'enter-city': return { selectedId: action.countryId, focusedId: action.countryId, cityId: action.id };
    case 'leave-city': return { ...state, cityId: null };
    case 'clear': return { selectedId: null, focusedId: null, cityId: null };
    case 'restore': return action.state;
  }
}

function readNavigation(data: TravelData): Navigation {
  const cityMatch = /^#city\/([a-z0-9-]+)$/.exec(window.location.hash);
  const city = data.cities.find((candidate) => candidate.id === cityMatch?.[1]);
  if (city) return { selectedId: city.countryId, focusedId: city.countryId, cityId: city.id };
  const match = /^#(country|europe)\/([a-z0-9-]+)$/.exec(window.location.hash);
  const id = match?.[2];
  if (!id || !data.countries.some((country) => country.id === id)) return { selectedId: null, focusedId: null, cityId: null };
  return { selectedId: id, focusedId: match?.[1] === 'country' ? id : null, cityId: null };
}

function CountryCard({ country, photos, entered, onEnter, onClose }: {
  country: TravelData['countries'][number]; photos: TravelData['photos']; entered: boolean;
  onEnter: () => void; onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  return <section className="country-card" aria-label={`${country.name} preview`}>
    <button className="country-card-close" aria-label="Close country preview" onClick={onClose}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
    </button>
    <div className="country-photo-window">
      <div className="country-photo-strip" style={{ transform: `translateX(-${index * 100}%)` }}>
        {photos.map((photo, number) => <div className="country-photo-slide" key={photo.id} aria-hidden={number !== index}><CountryPhoto photo={photo} /></div>)}
      </div>
      {index > 0 && <button className="photo-arrow photo-arrow--previous" aria-label="Previous photo" onClick={() => setIndex(index - 1)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>}
      {index < photos.length - 1 && <button className="photo-arrow photo-arrow--next" aria-label="Next photo" onClick={() => setIndex(index + 1)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>}
    </div>
    <div className="country-card-copy"><div><p className="eyebrow">Country journal</p><h3>{country.name}</h3></div>
      <button className="primary-button" onClick={onEnter} disabled={entered} aria-label={`Enter ${country.name}`}>{entered ? 'Exploring' : 'Enter ↗'}</button></div>
    <div className="photo-pagination" aria-label="Country photos">{photos.map((item, number) =>
      <button key={item.id} aria-label={`Photo ${number + 1}`} aria-pressed={number === index} onClick={() => setIndex(number)}>{String(number + 1).padStart(2, '0')}</button>)}</div>
  </section>;
}

export function CountryExplorer({ data }: { data: TravelData }) {
  const [navigation, dispatch] = useReducer(reducer, data, readNavigation);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);
  const [domesticOnly, setDomesticOnly] = useState(false);
  const [cityPoiFocusRequest, setCityPoiFocusRequest] = useState<CityPoiFocusRequest | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const selected = data.countries.find((country) => country.id === navigation.selectedId);
  const activeCity = data.cities.find((city) => city.id === navigation.cityId);
  const cityPois = (data.pois ?? []).filter((poi) => poi.cityId === activeCity?.id);
  const cityContext = (data.cityContexts ?? []).find((context) => context.cityId === activeCity?.id);
  const photos = data.photos.filter((photo) => photo.countryId === selected?.id).sort((a, b) => a.displayOrder - b.displayOrder);

  function navigate(action: Action) {
    const next = reducer(navigation, action);
    const hash = next.cityId ? `#city/${next.cityId}` : next.focusedId ? `#country/${next.focusedId}` : next.selectedId ? `#europe/${next.selectedId}` : '#europe';
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    dispatch(action);
  }
  function enterCity(id: string) {
    const city = data.cities.find((candidate) => candidate.id === id);
    if (city) {
      setCityPoiFocusRequest(null);
      navigate({ type: 'enter-city', id: city.id, countryId: city.countryId });
    }
  }
  function close(restoreFocus = false) {
    const id = navigation.selectedId;
    navigate({ type: 'clear' });
    setHoveredId(null);
    if (restoreFocus && id) requestAnimationFrame(() => root.current?.querySelector<SVGGElement>(`[data-country-id="${id}"]`)?.focus());
  }
  useEffect(() => {
    const restore = () => { dispatch({ type: 'restore', state: readNavigation(data) }); setHoveredId(null); };
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    return () => { window.removeEventListener('hashchange', restore); window.removeEventListener('popstate', restore); };
  }, [data]);
  useEffect(() => {
    if (!selected) return;
    const click = (event: MouseEvent) => {
      // The clicked arrow may unmount at the first/last photo. The original
      // event path retains its card ancestor even after that DOM update.
      const inside = event.composedPath().some((node) => node instanceof Element
        && node.matches('.country-card, [data-country-id], [data-city-id], [data-segment-id], .segment-details, .city-selection, .country-switcher, .map-toolbar, .poi-progress-sidebar, .city-review-sidebar'));
      if (!inside && !navigation.cityId) close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      if (navigation.cityId) navigate({ type: 'leave-city' });
      else close(true);
    };
    document.addEventListener('click', click);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', key); };
  });

  const segments = selected ? data.segments.filter((segment) => segment.originCountryId === selected.id) : data.segments;
  const counts = TRANSPORT_MODES.map(([name, color]) => ({ name, color, count: segments.filter((segment) => segment.transportationCategory === name).length }));
  const maximum = Math.max(1, ...counts.map(({ count }) => count));

  return <div className="travel-workspace" ref={root}>
    <section className="map-panel" aria-labelledby="map-heading">
      <header className="map-panel-heading"><div><p className="eyebrow">The journey so far</p>
        <h2 id="map-heading">{activeCity ? `${activeCity.name} / City Map` : navigation.focusedId ? `${selected?.name} / Country Map` : 'Europe overview'}</h2></div>
      </header>
      <div className="map-toolbar">
        {activeCity ? <button className="map-back" onClick={() => navigate({ type: 'leave-city' })}>Back to {selected?.name}</button>
          : navigation.focusedId && <button className="map-back" onClick={() => close(true)}>Back to Europe</button>}
        {!activeCity && <label className="route-toggle"><input type="checkbox" checked={showRoutes} onChange={(event) => setShowRoutes(event.target.checked)} /> Show travel routes</label>}
        {navigation.focusedId && !activeCity && <label className="route-toggle"><input type="checkbox" checked={domesticOnly} onChange={(event) => setDomesticOnly(event.target.checked)} /> Only show domestic routes</label>}
      </div>
      <div className={`poi-review-map-layout${activeCity ? ' poi-review-map-layout--city' : ''}`}>
        {!activeCity && (navigation.focusedId && selected
          ? <CityList countryId={selected.id} data={data} onEnter={enterCity} />
          : <CountryList data={data} onEnter={(id) => navigate({ type: 'enter', id })} />)}
        <div className="map-canvas">
          {activeCity ? <CityAttractionMap city={activeCity} pois={cityPois} context={cityContext}
            focusRequest={cityPoiFocusRequest} />
            : <EuropeMap countries={data.countries} cities={data.cities} segments={data.segments}
            showRoutes={showRoutes} domesticOnly={domesticOnly} selectedId={navigation.selectedId}
            hoveredId={hoveredId} focusedId={navigation.focusedId}
            onSelect={(id) => navigate({ type: 'select', id })}
            onEnter={(id) => navigate({ type: 'enter', id })}
            onEnterCity={enterCity} onHover={setHoveredId} />}
        </div>
      </div>
      {!activeCity && <div className="country-card-dock">
        {selected ? <CountryCard key={selected.id} country={selected} photos={photos} entered={Boolean(navigation.focusedId)}
          onEnter={() => navigate({ type: 'enter' })} onClose={() => close(true)} />
          : <p className="map-instruction">Select a country to explore its photographs.</p>}
      </div>}
      {!activeCity && <label className="country-switcher">Choose a country
        <select value={navigation.selectedId ?? ''} onChange={(event) => event.target.value ? navigate({ type: 'select', id: event.target.value }) : close()}>
          <option value="">Europe overview</option>{data.countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
        </select>
      </label>}
    </section>
    <aside className="journey-dashboard" aria-label="Journey dashboard">
      {activeCity ? <CityPoiList cityName={activeCity.name} pois={cityPois}
        onFocus={(poiId) => setCityPoiFocusRequest((current) => ({
          poiId,
          requestId: (current?.requestId ?? 0) + 1,
        }))} />
        : <><p className="eyebrow">The journey in numbers</p><h2>Dashboard</h2>
        <p className="dashboard-scope">{selected?.name ?? 'All countries'}</p>
        {segments.length ? <><p className="dashboard-total"><strong>{segments.length}</strong> transport segments</p>
        <p className="dashboard-caption">{selected ? 'Departing from this country' : 'Transportation / segment count'}</p>
        <div className="transport-bars">{counts.map(({ name, color, count }) => <div key={name}>
          <div className="transport-bar-label"><span>{name}</span><b>{count}</b></div>
          <div className="transport-bar-track"><span key={selected?.id ?? 'all'} style={{ width: `${count / maximum * 100}%`, backgroundColor: color }} /></div>
        </div>)}</div></> : <p className="dashboard-empty">No transportation data</p>}
        <p className="dashboard-footer">{selected ? photos.length : data.photos.length} photographs</p></>}
    </aside>
  </div>;
}
