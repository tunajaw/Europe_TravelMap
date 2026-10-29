import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import {
  CITY_MAP_HEIGHT,
  CITY_MAP_WIDTH,
  cityBoundaryPath,
  cityMapZoom,
  cityMapTiles,
  cityPanBounds,
  cityPoiFocusViewport,
  cityPoiViewport,
  constrainCityViewport,
  interpolateViewport,
  panViewport,
  projectCityPoint,
  zoomViewportAtPoint,
  zoomViewportFromBox,
  type CityMapBox,
} from './city-viewport.ts';
import {
  POI_REVIEW_CATEGORIES,
  type PoiReviewCategory,
  type PoiReviewMap,
  type PoiReviewRecord,
} from './poi-review-store.ts';
import { googleMapsPoiUrl } from './poi-map-link.ts';

type Poi = NonNullable<TravelData['pois']>[number];

function PoiReviewPanel({ poi, review, onReview }: {
  poi: Poi;
  review?: PoiReviewRecord | undefined;
  onReview: (record: PoiReviewRecord) => void;
}) {
  const [name, setName] = useState(review?.editedName ?? poi.name);
  const [localizedName, setLocalizedName] = useState(review
    ? review.editedLocalizedName ?? ''
    : poi.localizedName ?? '');
  const [category, setCategory] = useState<PoiReviewCategory>(
    review?.decision === 'Keep' && review.categories[0] ? review.categories[0] : 'Attractions',
  );

  const recordReview = (decision: 'Keep' | 'Discard') => {
    const editedName = name.trim();
    if (!editedName) return;
    onReview({
      poiId: poi.id,
      editedName,
      editedLocalizedName: localizedName.trim() || null,
      decision,
      categories: decision === 'Keep' ? [category] : [],
      reviewStatus: 'reviewed',
      updatedAt: new Date().toISOString(),
    });
  };

  return <form className="poi-review-panel" aria-label="POI review panel" onSubmit={(event) => {
    event.preventDefault();
    recordReview('Keep');
  }}>
    <div className="poi-review-panel-heading">
      <div><p className="eyebrow">Temporary data QA</p><h3>Review POI</h3></div>
      {review && <span className={`poi-review-status poi-review-status--${review.decision.toLowerCase()}`}>
        Reviewed · {review.decision}
      </span>}
    </div>
    <label className="poi-review-name">English / primary name
      <input aria-label="English name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
    </label>
    <label className="poi-review-name">Chinese name (optional)
      <input aria-label="Chinese name" lang="zh-Hant" value={localizedName}
        onChange={(event) => setLocalizedName(event.currentTarget.value)} />
    </label>
    <fieldset className="poi-review-categories"><legend>Categories</legend>
      {POI_REVIEW_CATEGORIES.map((value) => <label key={value}>
        <input type="radio" name={`category-${poi.id}`} checked={category === value}
          onChange={() => setCategory(value)} /> {value}
      </label>)}
    </fieldset>
    <div className="poi-review-actions">
      <button className="poi-review-save" type="submit" aria-label="Save POI"
        disabled={!name.trim()}>✓ Save POI</button>
      <button className="poi-review-discard" type="button" aria-label="Discard POI"
        disabled={!name.trim()} onClick={() => recordReview('Discard')}>✕ Discard POI</button>
    </div>
  </form>;
}

type CityMapPan = {
  startX: number;
  startY: number;
  startViewport: ReturnType<typeof cityPoiViewport>;
};

export function CityAttractionMap({ city, pois, context, reviews, onReview }: {
  city: TravelData['cities'][number];
  pois: NonNullable<TravelData['pois']>;
  context?: NonNullable<TravelData['cityContexts']>[number] | undefined;
  reviews: PoiReviewMap;
  onReview: (record: PoiReviewRecord) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragBox, setDragBox] = useState<CityMapBox | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [visibleCategories, setVisibleCategories] = useState({ Attraction: true, Unclassified: true });
  const initialViewport = useMemo(() => cityPoiViewport(city, pois, context?.boundary), [city, pois, context]);
  const initialTileZoom = useMemo(() => cityMapZoom(initialViewport), [initialViewport]);
  const panBounds = useMemo(
    () => cityPanBounds(city, context?.boundary, initialViewport),
    [city, context?.boundary, initialViewport],
  );
  const [viewport, setViewport] = useState(initialViewport);
  const [tileZoom, setTileZoom] = useState(initialTileZoom);
  const [isZoomed, setIsZoomed] = useState(false);
  const mapRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef(viewport);
  const animationFrameRef = useRef<number | null>(null);
  const panDragRef = useRef<CityMapPan | null>(null);
  const boundaryPath = useMemo(() => context ? cityBoundaryPath(context.boundary, viewport) : '', [context, viewport]);
  const tiles = useMemo(() => cityMapTiles(viewport, CITY_MAP_WIDTH, CITY_MAP_HEIGHT, tileZoom), [tileZoom, viewport]);
  const visiblePois = pois.filter((poi) => visibleCategories[poi.category]);
  const active = visiblePois.find((poi) => poi.id === (hoveredId ?? selectedId));
  const selectedPoi = pois.find((poi) => poi.id === selectedId);
  const pendingPois = pois.filter((poi) => !reviews[poi.id]);
  const reviewedCount = pois.length - pendingPois.length;

  useEffect(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    viewportRef.current = initialViewport;
    setViewport(initialViewport);
    setTileZoom(initialTileZoom);
    setIsZoomed(false);
    setDragBox(null);
    panDragRef.current = null;
    setIsPanning(false);
    setVisibleCategories({ Attraction: true, Unclassified: true });
  }, [city.id, initialTileZoom, initialViewport]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (selectedId || dragBox || panDragRef.current)) {
        event.preventDefault();
        setSelectedId(null);
        setHoveredId(null);
        setDragBox(null);
        panDragRef.current = null;
        setIsPanning(false);
      }
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [dragBox, selectedId]);

  const pointerPosition = (element: SVGSVGElement, clientX: number, clientY: number): [number, number] => {
    const bounds = element.getBoundingClientRect();
    return [
      (clientX - bounds.left) / bounds.width * CITY_MAP_WIDTH,
      (clientY - bounds.top) / bounds.height * CITY_MAP_HEIGHT,
    ];
  };

  const animateToViewport = (target: typeof viewport, nextIsZoomed: boolean) => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    const start = viewportRef.current;
    const targetTileZoom = cityMapZoom(target);
    setTileZoom(Math.min(cityMapZoom(start), targetTileZoom));
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reducedMotion) {
      viewportRef.current = target;
      setViewport(target);
      setTileZoom(targetTileZoom);
      setIsZoomed(nextIsZoomed);
      return;
    }
    const startedAt = performance.now();
    const tick = (now: number) => {
      const linearProgress = Math.min(1, (now - startedAt) / 260);
      const easedProgress = 1 - (1 - linearProgress) ** 3;
      const frame = interpolateViewport(start, target, easedProgress);
      viewportRef.current = frame;
      setViewport(frame);
      if (linearProgress < 1) animationFrameRef.current = requestAnimationFrame(tick);
      else {
        animationFrameRef.current = null;
        setTileZoom(targetTileZoom);
        setIsZoomed(nextIsZoomed);
      }
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const [x, y] = pointerPosition(map, event.clientX, event.clientY);
      const currentViewport = viewportRef.current;
      const candidate = zoomViewportAtPoint(currentViewport, x, y, event.deltaY < 0 ? 0.72 : 1.38);
      const initialLongitudeSpan = initialViewport.east - initialViewport.west;
      const candidateLongitudeSpan = candidate.east - candidate.west;
      if (event.deltaY > 0 && candidateLongitudeSpan >= initialLongitudeSpan) {
        animateToViewport(initialViewport, false);
      } else {
        animateToViewport(constrainCityViewport(candidate, panBounds), true);
      }
    };
    map.addEventListener('wheel', handleWheel, { passive: false });
    return () => map.removeEventListener('wheel', handleWheel);
  }, [initialViewport, panBounds]);

  const finishBoxZoom = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragBox) return;
    const [endX, endY] = pointerPosition(event.currentTarget, event.clientX, event.clientY);
    const completedBox = { ...dragBox, endX, endY };
    const nextViewport = zoomViewportFromBox(viewportRef.current, completedBox);
    if (nextViewport) animateToViewport(constrainCityViewport(nextViewport, panBounds), true);
    setDragBox(null);
  };

  const selectionRectangle = dragBox ? {
    x: Math.min(dragBox.startX, dragBox.endX),
    y: Math.min(dragBox.startY, dragBox.endY),
    width: Math.abs(dragBox.endX - dragBox.startX),
    height: Math.abs(dragBox.endY - dragBox.startY),
  } : null;

  const selectForReview = (poi: Poi) => {
    setSelectedId(poi.id);
    setHoveredId(null);
    animateToViewport(constrainCityViewport(
      cityPoiFocusViewport(initialViewport, poi.location, pois.length),
      panBounds,
    ), true);
  };

  return <section className="city-attraction-explorer">
    <div className="city-review-layout">
    <nav className="city-review-sidebar" aria-label="Unreviewed POIs">
      <div className="poi-progress-heading"><p className="eyebrow">Temporary QA</p><h3>Unreviewed POIs</h3>
        <p>{reviewedCount} / {pois.length} reviewed</p></div>
      <div className="city-review-pending-list">
        {pendingPois.map((poi) => <div className="city-review-pending-item" key={poi.id}>
          <button type="button" aria-label={`Review ${poi.name}`}
            onClick={() => selectForReview(poi)}>{poi.name}</button>
          <a href={googleMapsPoiUrl(poi)} target="_blank" rel="noreferrer"
            aria-label={`Open ${poi.name} in Google Maps`}>Google Maps ↗</a>
        </div>)}
        {pendingPois.length === 0 && <p className="poi-review-complete">All POIs reviewed.</p>}
      </div>
    </nav>
    <div className="city-review-main">
    <div className="city-map-controls" aria-label="City map controls">
      <button type="button" disabled={!isZoomed}
        onClick={() => {
          animateToViewport(initialViewport, false);
          setDragBox(null);
          panDragRef.current = null;
          setIsPanning(false);
        }}>
        Reset view
      </button>
      <span>Drag to pan · Shift-drag a box or use the mouse wheel to zoom</span>
      <fieldset className="city-poi-filters">
        <legend>Show places</legend>
        {(['Attraction', 'Unclassified'] as const).map((category) => <label key={category}>
          <input type="checkbox" checked={visibleCategories[category]}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              setVisibleCategories((current) => ({ ...current, [category]: checked }));
              if (!checked && pois.find((poi) => poi.id === selectedId)?.category === category) setSelectedId(null);
              if (!checked && pois.find((poi) => poi.id === hoveredId)?.category === category) setHoveredId(null);
            }} />
          <span className={`city-poi-legend city-poi-legend--${category.toLowerCase()}`} aria-hidden="true" />
          {category}
        </label>)}
      </fieldset>
    </div>
    <svg ref={mapRef} className={`city-attraction-map${isPanning ? ' city-attraction-map--panning' : ''}`}
      role="group" aria-label={`${city.name} city map`}
      viewBox={`0 0 ${CITY_MAP_WIDTH} ${CITY_MAP_HEIGHT}`}
      data-geo-bounds={`${viewport.west},${viewport.south},${viewport.east},${viewport.north}`}
      data-zoomed={isZoomed ? 'true' : 'false'}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const [startX, startY] = pointerPosition(event.currentTarget, event.clientX, event.clientY);
        if (event.shiftKey) {
          setDragBox({ startX, startY, endX: startX, endY: startY });
        } else {
          panDragRef.current = { startX, startY, startViewport: viewportRef.current };
          setIsPanning(true);
        }
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        const [endX, endY] = pointerPosition(event.currentTarget, event.clientX, event.clientY);
        if (dragBox) {
          setDragBox((current) => current ? { ...current, endX, endY } : null);
          return;
        }
        const pan = panDragRef.current;
        if (!pan) return;
        const nextViewport = constrainCityViewport(
          panViewport(pan.startViewport, endX - pan.startX, endY - pan.startY),
          panBounds,
        );
        viewportRef.current = nextViewport;
        setViewport(nextViewport);
        if (Math.abs(endX - pan.startX) >= 2 || Math.abs(endY - pan.startY) >= 2) setIsZoomed(true);
      }}
      onPointerUp={(event) => {
        if (dragBox) finishBoxZoom(event);
        panDragRef.current = null;
        setIsPanning(false);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }}
      onPointerCancel={() => {
        setDragBox(null);
        panDragRef.current = null;
        setIsPanning(false);
      }}
      onDoubleClick={(event) => {
        if (!isZoomed) return;
        event.preventDefault();
        animateToViewport(initialViewport, false);
        setDragBox(null);
        panDragRef.current = null;
        setIsPanning(false);
      }}>
      <defs><clipPath id={`city-map-clip-${city.id}`}><rect width={CITY_MAP_WIDTH} height={CITY_MAP_HEIGHT} rx="18" /></clipPath></defs>
      <rect className="city-map-background" width={CITY_MAP_WIDTH} height={CITY_MAP_HEIGHT} rx="18" />
      <g className="city-map-tiles" aria-hidden="true" clipPath={`url(#city-map-clip-${city.id})`}>
        {tiles.map((tile) => <image key={tile.key} href={tile.href}
          x={tile.x} y={tile.y} width={tile.width} height={tile.height} preserveAspectRatio="none" />)}
      </g>
      {boundaryPath && <path className="city-map-city-fill" d={boundaryPath} fillRule="evenodd" />}
      {boundaryPath && <path
        className={`city-map-city-boundary city-map-city-boundary--${context?.kind ?? 'missing'}`}
        d={boundaryPath} fillRule="evenodd" data-testid="city-boundary" />}
      <g aria-label="Points of interest">
        {visiblePois.map((poi) => {
          const [x, y] = projectCityPoint(poi.location, viewport);
          const isActive = poi.id === hoveredId || poi.id === selectedId;
          const review = reviews[poi.id];
          const isReviewed = Boolean(review);
          const reviewDecision = review?.decision.toLowerCase();
          return <g key={poi.id} role="button" tabIndex={0} aria-label={poi.name}
            aria-pressed={selectedId === poi.id} data-poi-id={poi.id}
            data-review-status={isReviewed ? 'reviewed' : 'unreviewed'}
            data-review-decision={reviewDecision}
            className={`attraction-marker attraction-marker--${poi.category.toLowerCase()}${reviewDecision ? ` attraction-marker--review-${reviewDecision}` : ''}${isActive ? ' attraction-marker--active' : ''}`}
            transform={`translate(${x} ${y})`}
            onMouseEnter={() => setHoveredId(poi.id)} onMouseLeave={() => setHoveredId(null)}
            onFocus={() => setHoveredId(poi.id)} onBlur={() => setHoveredId(null)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setSelectedId((current) => current === poi.id ? null : poi.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedId((current) => current === poi.id ? null : poi.id);
              }
            }}>
            <circle className="attraction-marker-hit" r="22" />
            {poi.category === 'Attraction'
              ? <circle data-testid="attraction-marker" r={isActive ? 9 : 7} />
              : <path data-testid="unclassified-marker"
                d={isActive ? 'M 0 -11 L 10 8 L -10 8 Z' : 'M 0 -9 L 8 7 L -8 7 Z'} />}
            {review?.decision === 'Keep' && <g className="poi-review-badge poi-review-badge--keep"
              transform="translate(9 -9)" aria-hidden="true">
              <circle r="6.5" />
              <path data-testid="poi-review-keep" d="M -3 0 L -0.8 2.4 L 3.6 -2.8" />
            </g>}
            {review?.decision === 'Discard' && <g className="poi-review-badge poi-review-badge--discard"
              transform="translate(9 -9)" aria-hidden="true">
              <circle r="6.5" />
              <path data-testid="poi-review-discard" d="M -2.8 -2.8 L 2.8 2.8 M 2.8 -2.8 L -2.8 2.8" />
            </g>}
          </g>;
        })}
      </g>
      {selectionRectangle && <rect className="city-map-zoom-selection" data-testid="city-map-zoom-selection"
        x={selectionRectangle.x} y={selectionRectangle.y}
        width={selectionRectangle.width} height={selectionRectangle.height} />}
    </svg>
    <p className="city-map-attribution">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
      {context?.source === 'Reviewed city reference' && ' · Dashed outline is a local extent around the reviewed City reference point'}
    </p>
    <section className="poi-metadata" aria-label="POI metadata" aria-live="polite">
      {active ? <><p className="eyebrow">{active.category}</p><h3>{active.name}</h3>
        {active.localizedName && <p className="poi-localized-name">{active.localizedName}</p>}
        <p className="poi-subcategory">{active.subcategory}</p>
        {!reviews[active.id] && <code className="poi-metadata-coordinates">
          {active.location.latitude.toFixed(6)}, {active.location.longitude.toFixed(6)}
        </code>}</>
        : <><p className="eyebrow">{city.name}</p><h3>Places</h3><p>{visiblePois.length
          ? 'Hover or focus a point to see its name.'
          : pois.length ? 'No places match the current filters.' : 'No reviewed places yet'}</p></>}
    </section>
    {selectedPoi && <PoiReviewPanel key={`${selectedPoi.id}-${reviews[selectedPoi.id]?.updatedAt ?? 'new'}`}
      poi={selectedPoi} review={reviews[selectedPoi.id]} onReview={onReview} />}
    </div>
    </div>
  </section>;
}
