import { useEffect, useRef, useState } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { googleMapsPoiUrl } from './poi-map-link.ts';
import { PoiImageGallery, usePoiImageReview } from './PoiImageReview.tsx';

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

export function CityPoiList({ cityName, pois, onFocus, selectedPoiId }: {
  cityName: string;
  pois: Poi[];
  onFocus: (poiId: string) => void;
  selectedPoiId?: string | null;
}) {
  const imageReviewEnabled = import.meta.env.DEV;
  const review = usePoiImageReview(imageReviewEnabled);
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadPoiId, setUploadPoiId] = useState<string | null>(null);
  const galleryPoi = pois.find(({ id }) => id === galleryId);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const item = selectedItemRef.current;
    if (!selectedPoiId || !list || !item) return;
    const listBounds = list.getBoundingClientRect();
    const itemBounds = item.getBoundingClientRect();
    if (itemBounds.top >= listBounds.top && itemBounds.bottom <= listBounds.bottom) return;
    list.scrollTo({
      top: list.scrollTop + itemBounds.top - listBounds.top - (list.clientHeight - itemBounds.height) / 2,
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }, [selectedPoiId]);
  return <nav className="city-poi-dashboard" aria-label="POI list">
    <div className="city-poi-dashboard-heading">
      <p className="eyebrow">Explore {cityName}</p>
      <h2>Places</h2>
      <p>{pois.length} reviewed POIs</p>
    </div>
    {imageReviewEnabled && <>
      <p className="poi-image-review-hint">Internal image review · Drop images on a POI. Alt-click a POI to choose files. Saved only in this browser; clearing site data removes assignments and images.</p>
      <input ref={fileInput} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        aria-label="Choose POI images" onChange={(event) => {
          if (uploadPoiId) void review.add(uploadPoiId, Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = '';
        }} />
      <p className="poi-image-status" role="status">{review.pending ? 'Saving images…' : review.status}</p>
    </>}
    <div className="city-poi-dashboard-list" ref={listRef}>{pois.map((poi) => <div
      ref={selectedPoiId === poi.id ? selectedItemRef : undefined}
      className={`city-poi-dashboard-item city-poi-dashboard-item--${poi.category.toLowerCase()}${draggingId === poi.id ? ' city-poi-dashboard-item--dragging' : ''}`} key={poi.id}>
      <button type="button" className={imageReviewEnabled ? 'poi-image-drop-target' : undefined}
        aria-label={`Focus ${poi.name}`}
        aria-pressed={selectedPoiId === poi.id}
        onDragOver={(event) => {
          if (!imageReviewEnabled) return;
          event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDraggingId(poi.id);
        }}
        onDragLeave={() => setDraggingId(null)}
        onDrop={(event) => {
          if (!imageReviewEnabled) return;
          event.preventDefault(); event.stopPropagation(); setDraggingId(null);
          void review.add(poi.id, Array.from(event.dataTransfer.files));
        }}
        onClick={(event) => {
          if (imageReviewEnabled && event.altKey && review.ready) {
            setUploadPoiId(poi.id); fileInput.current?.click();
          } else onFocus(poi.id);
        }}>
        <span>{poi.name}</span><small>{poi.category}</small>
      </button>
      {imageReviewEnabled && review.images.some((image) => image.poiId === poi.id) && <button
        type="button" className="poi-image-count" aria-label={`View images for ${poi.name}`}
        onClick={() => setGalleryId(poi.id)}>
        {review.images.filter((image) => image.poiId === poi.id).length}
      </button>}
      <a href={googleMapsPoiUrl(poi)} target="_blank" rel="noreferrer"
        aria-label={`Open ${poi.name} in Google Maps`}>↗</a>
    </div>)}</div>
    {pois.length === 0 && <p className="city-poi-dashboard-empty">No reviewed places yet.</p>}
    {imageReviewEnabled && galleryPoi && <PoiImageGallery key={galleryPoi.id} name={galleryPoi.name}
      images={review.images.filter((image) => image.poiId === galleryPoi.id)}
      saving={review.pending > 0}
      status={review.status}
      onMove={(sourceId, targetId) => { void review.move(galleryPoi.id, sourceId, targetId); }}
      onRemove={(id) => { void review.remove(id); }} onClose={() => setGalleryId(null)} />}
  </nav>;
}
