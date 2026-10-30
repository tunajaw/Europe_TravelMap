// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import source from '../../public/data/travel-data.json';
import { TravelDataSchema, type TravelData } from '../../src/domain/travel-data.ts';
import { CountryExplorer } from '../../src/features/map/CountryExplorer.tsx';
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
  projectCityPoint,
  panViewport,
  zoomViewportAtPoint,
  zoomViewportFromBox,
} from '../../src/features/map/city-viewport.ts';

const data = TravelDataSchema.parse(source);
const city = data.cities.find((candidate) => {
  const categories = new Set((data.pois ?? []).filter((poi) => poi.cityId === candidate.id).map((poi) => poi.category));
  return categories.has('Attraction') && categories.has('Unclassified');
}) ?? data.cities.find((candidate) => (data.pois ?? []).some((poi) => poi.cityId === candidate.id))!;
const cityPois = (data.pois ?? []).filter((poi) => poi.cityId === city.id);
const attractionPois = cityPois.filter((poi) => poi.category === 'Attraction');
const unclassifiedPois = cityPois.filter((poi) => poi.category === 'Unclassified');
const cityWithoutPois = data.cities.find((candidate) => !(data.pois ?? []).some((poi) => poi.cityId === candidate.id))!;

beforeEach(() => {
  window.history.replaceState(null, '', `#city/${city.id}`);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: true }),
  });
});
afterEach(cleanup);

describe('FR-MAP-10 City Attraction Map', () => {
  it('turns a visible box selection into a smaller aspect-preserving viewport', () => {
    const initial = { west: 0, south: 0, east: 100, north: 38 };
    expect(zoomViewportFromBox(initial, { startX: 200, startY: 76, endX: 700, endY: 266 }))
      .toEqual({ west: 20, east: 70, south: 11.399999999999999, north: 30.4 });
    expect(zoomViewportFromBox(initial, { startX: 10, startY: 10, endX: 18, endY: 18 })).toBeNull();
  });

  it('derives a small OSM tile set and requests more detail after box zoom', () => {
    const initial = { west: 2, south: 48, east: 3, north: 49 };
    const zoomed = zoomViewportFromBox(initial, { startX: 250, startY: 95, endX: 750, endY: 285 })!;
    const initialTiles = cityMapTiles(initial);
    const zoomedTiles = cityMapTiles(zoomed);
    const zoomLevel = (href: string) => Number(new URL(href).pathname.split('/')[1]);
    expect(initialTiles.length).toBeGreaterThan(0);
    expect(initialTiles.length).toBeLessThan(20);
    expect(initialTiles.every(({ href }) => href.startsWith('https://tile.openstreetmap.org/'))).toBe(true);
    expect(zoomLevel(zoomedTiles[0]!.href)).toBeGreaterThan(zoomLevel(initialTiles[0]!.href));
  });

  it('keeps one OSM tile zoom level throughout an animated POI focus', () => {
    const initial = { west: 3.16, south: 51.19, east: 3.27, north: 51.22 };
    const focused = zoomViewportAtPoint(initial, 500, 40, 0.28);
    const transitionZoom = Math.min(cityMapZoom(initial), cityMapZoom(focused));
    const midpoint = interpolateViewport(initial, focused, 0.5);
    const zoomLevels = [initial, midpoint, focused].flatMap((frame) => cityMapTiles(
      frame, CITY_MAP_WIDTH, CITY_MAP_HEIGHT, transitionZoom,
    ).map(({ href }) => Number(new URL(href).pathname.split('/')[1])));
    expect(new Set(zoomLevels)).toEqual(new Set([transitionZoom]));
  });

  it('zooms around the wheel pointer and interpolates the viewport', () => {
    const initial = { west: 0, south: 0, east: 100, north: 40 };
    expect(zoomViewportAtPoint(initial, 250, 95, 0.5)).toEqual({
      west: 12.5, east: 62.5, south: 15, north: 35,
    });
    expect(interpolateViewport(initial, { west: 20, south: 10, east: 60, north: 30 }, 0.5))
      .toEqual({ west: 10, south: 5, east: 80, north: 35 });
  });

  it('pans the viewport and clamps it near the primary City boundary', () => {
    const initial = { west: 0, south: 0, east: 10, north: 4 };
    expect(panViewport(initial, 100, 95)).toEqual({ west: -1, east: 9, south: 1, north: 5 });
    const syntheticCity = { ...city, location: { latitude: 2, longitude: 5 } };
    const boundary: NonNullable<TravelData['cityContexts']>[number]['boundary'] = {
      type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 4], [0, 4], [0, 0]]],
    };
    const bounds = cityPanBounds(syntheticCity, boundary, initial);
    const constrained = constrainCityViewport({ west: -100, east: -95, south: 50, north: 52 }, bounds);
    expect(constrained.west).toBeGreaterThan(-2);
    expect(constrained.north).toBeLessThan(6);
  });

  it('allows a reviewed City POI outside the administrative boundary to be focused', () => {
    const munich = data.cities.find(({ id }) => id === 'city-munich')!;
    const munichPois = (data.pois ?? []).filter(({ cityId }) => cityId === munich.id);
    const context = data.cityContexts?.find(({ cityId }) => cityId === munich.id)!;
    const outlyingPoi = munichPois.find(({ name }) => name === 'Bahnhof, Herrsching a. Ammersee')!;
    const initial = cityPoiViewport(munich, munichPois, context.boundary);
    const panBounds = cityPanBounds(munich, context.boundary, initial);
    const focused = constrainCityViewport(
      cityPoiFocusViewport(initial, outlyingPoi.location, munichPois.length),
      panBounds,
    );
    const [x, y] = projectCityPoint(outlyingPoi.location, focused);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(CITY_MAP_WIDTH);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(CITY_MAP_HEIGHT);
    expect(focused.north - focused.south).toBeCloseTo(0.025);
  });

  it('focuses more closely in Cities with at least 25 POIs', () => {
    const initial = { west: 10, south: 47.5, east: 13, north: 48.5 };
    const location = { longitude: 11.5, latitude: 48 };
    const dense = cityPoiFocusViewport(initial, location, 25);
    const sparse = cityPoiFocusViewport(initial, location, 24);
    expect(dense.north - dense.south).toBeCloseTo(0.025);
    expect(dense.north - dense.south).toBeLessThan(sparse.north - sparse.south);
    expect((dense.north + dense.south) / 2).toBe(location.latitude);
    expect((dense.east + dense.west) / 2).toBe(location.longitude);
  });

  it('provides exactly one map context for every Travel Map City', () => {
    expect(data.cityContexts).toHaveLength(data.cities.length);
    expect(new Set(data.cityContexts?.map(({ cityId }) => cityId)))
      .toEqual(new Set(data.cities.map(({ id }) => id)));
    for (const candidateCity of data.cities) {
      const context = data.cityContexts?.find(({ cityId }) => cityId === candidateCity.id)!;
      const pois = (data.pois ?? []).filter(({ cityId }) => cityId === candidateCity.id);
      const viewport = cityPoiViewport(candidateCity, pois, context.boundary);
      expect(cityBoundaryPath(context.boundary, viewport), candidateCity.name).not.toBe('');
    }
  });

  it('fits the primary City polygon without zooming out for a detached enclave', () => {
    const syntheticCity = { ...city, location: { latitude: 1, longitude: 1 } };
    const boundary: NonNullable<TravelData['cityContexts']>[number]['boundary'] = { type: 'MultiPolygon', coordinates: [
      [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
      [[[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]]],
    ] };
    const viewport = cityPoiViewport(syntheticCity, [], boundary);
    expect(viewport.east).toBeLessThan(10);
    expect(viewport.north).toBeLessThan(10);
  });

  it('fits every POI inside a padded City viewport', () => {
    const context = (data.cityContexts ?? []).find((candidate) => candidate.cityId === city.id);
    const viewport = cityPoiViewport(city, cityPois, context?.boundary);
    for (const poi of cityPois) {
      const [x, y] = projectCityPoint(poi.location, viewport);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(CITY_MAP_WIDTH);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(CITY_MAP_HEIGHT);
    }
  });

  it('uses POI bounds rather than the full City boundary for the initial viewport', () => {
    const syntheticCity = { ...city, location: { latitude: 50, longitude: 10 } };
    const pois = [
      { ...cityPois[0]!, location: { latitude: 50, longitude: 10 } },
      { ...cityPois[0]!, id: `${cityPois[0]!.id}-2`, location: { latitude: 50.01, longitude: 10.01 } },
    ];
    const boundary: NonNullable<TravelData['cityContexts']>[number]['boundary'] = {
      type: 'Polygon', coordinates: [[[0, 40], [20, 40], [20, 60], [0, 60], [0, 40]]],
    };
    const viewport = cityPoiViewport(syntheticCity, pois, boundary);
    expect(viewport.east - viewport.west).toBeLessThan(0.1);
    expect(viewport.north - viewport.south).toBeLessThan(0.1);
  });

  it('renders category-distinct POIs, filters them, and reveals the name in metadata on hover or lock', async () => {
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    expect(screen.getByRole('group', { name: `${city.name} city map` })).toBeInTheDocument();
    expect(screen.queryAllByTestId('attraction-marker')).toHaveLength(attractionPois.length);
    expect(screen.queryAllByTestId('unclassified-marker')).toHaveLength(unclassifiedPois.length);
    expect(screen.getByTestId('city-boundary')).toBeInTheDocument();
    expect(container.querySelector('.city-attraction-map text')).not.toBeInTheDocument();

    const poi = cityPois.find((candidate) => cityPois.filter((row) => row.name === candidate.name).length === 1)!;
    const marker = screen.getByRole('button', { name: poi.name });
    const metadata = screen.getByRole('region', { name: 'POI metadata' });
    expect(within(metadata).queryByText(poi.name)).not.toBeInTheDocument();
    await user.hover(marker);
    expect(within(metadata).getByText(poi.name)).toBeInTheDocument();
    await user.click(marker);
    await user.unhover(marker);
    expect(within(metadata).getByText(poi.name)).toBeInTheDocument();

    if (unclassifiedPois.length > 0) {
      await user.click(screen.getByRole('checkbox', { name: 'Unclassified' }));
      expect(screen.queryAllByTestId('unclassified-marker')).toHaveLength(0);
      expect(screen.queryAllByTestId('attraction-marker')).toHaveLength(attractionPois.length);
    }
  });

  it('shows the English POI name first and an available Chinese name on a smaller second line', async () => {
    const user = userEvent.setup();
    const poi = cityPois[0]!;
    const bilingualData: TravelData = {
      ...data,
      pois: (data.pois ?? []).map((candidate) => candidate.id === poi.id
        ? { ...candidate, name: 'English place name', localizedName: '中文地名' }
        : candidate),
    };
    render(<CountryExplorer data={bilingualData} />);
    await user.hover(screen.getByRole('button', { name: 'English place name' }));
    const metadata = screen.getByRole('region', { name: 'POI metadata' });
    expect(within(metadata).getByRole('heading', { name: 'English place name' })).toBeInTheDocument();
    expect(within(metadata).getByText('中文地名')).toHaveClass('poi-localized-name');
  });

  it('zooms from a Shift-dragged box and can reset to the initial City viewport', async () => {
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    const map = screen.getByRole('group', { name: `${city.name} city map` });
    Object.defineProperty(map, 'getBoundingClientRect', { value: () => ({
      left: 0, top: 0, width: CITY_MAP_WIDTH, height: CITY_MAP_HEIGHT,
      right: CITY_MAP_WIDTH, bottom: CITY_MAP_HEIGHT, x: 0, y: 0, toJSON: () => ({}),
    }) });
    const initialBounds = map.getAttribute('data-geo-bounds');
    const reset = screen.getByRole('button', { name: 'Reset view' });
    expect(reset).toBeDisabled();

    fireEvent.pointerDown(map, { clientX: 200, clientY: 76, button: 0, pointerId: 1, shiftKey: true });
    fireEvent.pointerMove(map, { clientX: 700, clientY: 266, pointerId: 1, shiftKey: true });
    expect(screen.getByTestId('city-map-zoom-selection')).toBeInTheDocument();
    fireEvent.pointerUp(map, { clientX: 700, clientY: 266, button: 0, pointerId: 1 });
    await waitFor(() => expect(map.getAttribute('data-geo-bounds')).not.toBe(initialBounds));
    await waitFor(() => expect(reset).toBeEnabled());

    await user.click(reset);
    await waitFor(() => expect(map.getAttribute('data-geo-bounds')).toBe(initialBounds));
  });

  it('pans with an ordinary left-button drag without showing a zoom box', async () => {
    render(<CountryExplorer data={data} />);
    const map = screen.getByRole('group', { name: `${city.name} city map` });
    Object.defineProperty(map, 'getBoundingClientRect', { value: () => ({
      left: 0, top: 0, width: CITY_MAP_WIDTH, height: CITY_MAP_HEIGHT,
      right: CITY_MAP_WIDTH, bottom: CITY_MAP_HEIGHT, x: 0, y: 0, toJSON: () => ({}),
    }) });
    fireEvent.wheel(map, { clientX: 500, clientY: 190, deltaY: -120 });
    const zoomedBounds = map.getAttribute('data-geo-bounds');
    fireEvent.pointerDown(map, { clientX: 500, clientY: 190, button: 0, pointerId: 2 });
    fireEvent.pointerMove(map, { clientX: 580, clientY: 230, pointerId: 2 });
    expect(screen.queryByTestId('city-map-zoom-selection')).not.toBeInTheDocument();
    fireEvent.pointerUp(map, { clientX: 580, clientY: 230, button: 0, pointerId: 2 });
    expect(map.getAttribute('data-geo-bounds')).not.toBe(zoomedBounds);
  });

  it('zooms with the mouse wheel around the pointer', async () => {
    render(<CountryExplorer data={data} />);
    const map = screen.getByRole('group', { name: `${city.name} city map` });
    Object.defineProperty(map, 'getBoundingClientRect', { value: () => ({
      left: 0, top: 0, width: CITY_MAP_WIDTH, height: CITY_MAP_HEIGHT,
      right: CITY_MAP_WIDTH, bottom: CITY_MAP_HEIGHT, x: 0, y: 0, toJSON: () => ({}),
    }) });
    const initialBounds = map.getAttribute('data-geo-bounds');
    expect(fireEvent.wheel(map, { clientX: 650, clientY: 160, deltaY: -120 })).toBe(false);
    await waitFor(() => expect(map.getAttribute('data-geo-bounds')).not.toBe(initialBounds));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset view' })).toBeEnabled());
  });

  it('resets a zoomed City Map when the map is double-clicked', async () => {
    render(<CountryExplorer data={data} />);
    const map = screen.getByRole('group', { name: `${city.name} city map` });
    Object.defineProperty(map, 'getBoundingClientRect', { value: () => ({
      left: 0, top: 0, width: CITY_MAP_WIDTH, height: CITY_MAP_HEIGHT,
      right: CITY_MAP_WIDTH, bottom: CITY_MAP_HEIGHT, x: 0, y: 0, toJSON: () => ({}),
    }) });
    const initialBounds = map.getAttribute('data-geo-bounds');
    fireEvent.wheel(map, { clientX: 650, clientY: 160, deltaY: -120 });
    await waitFor(() => expect(map.getAttribute('data-geo-bounds')).not.toBe(initialBounds));
    fireEvent.doubleClick(map);
    await waitFor(() => expect(map.getAttribute('data-geo-bounds')).toBe(initialBounds));
  });

  it('draws the City context and empty metadata when a City has no reviewed Attraction', () => {
    window.history.replaceState(null, '', `#city/${cityWithoutPois.id}`);
    render(<CountryExplorer data={data} />);
    expect(screen.getByRole('group', { name: `${cityWithoutPois.name} city map` })).toBeInTheDocument();
    expect(screen.getByTestId('city-boundary')).toBeInTheDocument();
    expect(screen.queryAllByTestId('attraction-marker')).toHaveLength(0);
    expect(screen.getByText('No reviewed places yet')).toBeInTheDocument();
  });

  it('enters from a Country Map and returns to the same Country Map', async () => {
    window.history.replaceState(null, '', `#country/${city.countryId}`);
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    await user.dblClick(screen.getByRole('button', { name: city.name }));
    expect(window.location.hash).toBe(`#city/${city.id}`);
    await user.click(screen.getByRole('button', { name: /^Back to / }));
    expect(window.location.hash).toBe(`#country/${city.countryId}`);
  });
});
