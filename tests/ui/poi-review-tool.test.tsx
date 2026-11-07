// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import source from '../../public/data/travel-data.json';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';
import { CountryExplorer } from '../../src/features/map/CountryExplorer.tsx';
import { googleMapsPoiUrl } from '../../src/features/map/poi-map-link.ts';
import {
  POI_REVIEW_STORAGE_KEY,
  loadPoiReviews,
  parsePoiReviewFile,
  poiReviewSummary,
  serializePoiReviews,
  upsertPoiReview,
  type PoiReviewRecord,
} from '../../src/features/map/poi-review-store.ts';

const data = TravelDataSchema.parse(source);
const city = data.cities.find((candidate) => (data.pois ?? []).filter((poi) => poi.cityId === candidate.id).length >= 2)!;
const cityPois = (data.pois ?? []).filter((poi) => poi.cityId === city.id);

beforeEach(() => {
  window.localStorage.removeItem(POI_REVIEW_STORAGE_KEY);
  window.history.replaceState(null, '', `#city/${city.id}`);
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
});
afterEach(cleanup);

describe('temporary POI review tool', () => {
  it('uses coordinates for every Google Maps review link', () => {
    const base = { location: { latitude: 48.1, longitude: 11.5 } };
    expect(googleMapsPoiUrl(base))
      .toBe('https://www.google.com/maps/search/?api=1&query=48.1%2C11.5');
  });

  it('serializes, reloads, and upserts one record per POI ID', () => {
    const first: PoiReviewRecord = {
      poiId: 'poi-1', editedName: 'First', editedLocalizedName: '第一站', decision: 'Keep', categories: ['Attractions'],
      reviewStatus: 'reviewed', updatedAt: '2026-10-22T00:00:00.000Z',
    };
    const second = { ...first, editedName: 'Updated', decision: 'Discard' as const, categories: [] };
    const reviews = upsertPoiReview(upsertPoiReview({}, first), second);
    expect(Object.keys(reviews)).toEqual(['poi-1']);
    const restored = parsePoiReviewFile(serializePoiReviews(reviews, '2026-10-22T01:00:00.000Z'));
    expect(restored['poi-1']).toEqual(second);
  });

  it('migrates existing schema v1 reviews without losing their decision', () => {
    const restored = parsePoiReviewFile(JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-10-22T00:00:00.000Z',
      reviews: [{
        poiId: 'legacy-poi', editedName: 'Legacy', decision: 'Keep', categories: ['Attractions'],
        reviewStatus: 'reviewed', updatedAt: '2026-10-22T00:00:00.000Z',
      }],
    }));
    expect(restored['legacy-poi']).toEqual(expect.objectContaining({
      editedName: 'Legacy', editedLocalizedName: null, decision: 'Keep',
    }));
  });

  it('summarizes only reviews that belong to the current POI dataset', () => {
    const [accepted, rejected] = (data.pois ?? []).slice(0, 2);
    expect(accepted).toBeDefined();
    expect(rejected).toBeDefined();
    const record = (poiId: string, decision: 'Keep' | 'Discard'): PoiReviewRecord => ({
      poiId, editedName: poiId, editedLocalizedName: null, decision,
      categories: decision === 'Keep' ? ['Attractions'] : [],
      reviewStatus: 'reviewed', updatedAt: '2026-11-01T00:00:00.000Z',
    });
    const reviews = {
      [accepted!.id]: record(accepted!.id, 'Keep'),
      [rejected!.id]: record(rejected!.id, 'Discard'),
      stale: record('stale-poi-id', 'Keep'),
    };
    expect(poiReviewSummary(data.pois ?? [], reviews)).toEqual({
      total: data.pois?.length ?? 0,
      reviewed: 2,
      accepted: 1,
      rejected: 1,
    });

    window.localStorage.setItem(POI_REVIEW_STORAGE_KEY, serializePoiReviews(reviews));
    window.history.replaceState(null, '', '#europe');
    render(<CountryExplorer data={data} />);
    const panel = screen.getByRole('region', { name: 'Overall POI review summary' });
    expect(within(panel).getByText(String(data.pois?.length ?? 0))).toBeInTheDocument();
    expect(within(panel).getByText('2')).toBeInTheDocument();
    expect(within(panel).getAllByText('1')).toHaveLength(2);
    const onePoiPercent = (100 / (data.pois?.length ?? 1)).toFixed(1);
    expect(within(panel).getAllByText(`${onePoiPercent}% of all · 50.0% of reviewed`)).toHaveLength(2);
  });

  it('opens a review panel from a POI, keeps an edited record, and updates the pending list', async () => {
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    const poi = cityPois[0]!;
    const pending = screen.getByRole('navigation', { name: 'Unreviewed POIs' });
    expect(within(pending).getAllByRole('button')).toHaveLength(cityPois.length);
    const firstPendingItem = within(pending).getByRole('button', { name: `Review ${cityPois[0]!.name}` })
      .closest('.city-review-pending-item') as HTMLElement;
    expect(within(firstPendingItem).getByRole('link', { name: `Open ${cityPois[0]!.name} in Google Maps` }))
      .toHaveAttribute('href', googleMapsPoiUrl(cityPois[0]!));
    const map = screen.getByRole('group', { name: `${city.name} city map` });
    const initialBounds = map.getAttribute('data-geo-bounds');

    await user.click(within(pending).getByRole('button', { name: `Review ${poi.name}` }));
    expect(map).not.toHaveAttribute('data-geo-bounds', initialBounds);
    expect(within(screen.getByRole('region', { name: 'POI metadata' })).getByText(
      `${poi.location.latitude.toFixed(6)}, ${poi.location.longitude.toFixed(6)}`,
    )).toBeInTheDocument();
    const panel = screen.getByRole('form', { name: 'POI review panel' });
    const name = within(panel).getByRole('textbox', { name: 'English name' });
    const localizedName = within(panel).getByRole('textbox', { name: 'Chinese name' });
    expect(name).toHaveValue(poi.name);
    expect(localizedName).toHaveValue(poi.localizedName ?? '');
    expect(within(panel).getByRole('radio', { name: 'Attractions' })).toBeChecked();
    await user.clear(name);
    await user.type(name, 'Reviewed place');
    await user.clear(localizedName);
    await user.type(localizedName, '審核後景點');
    await user.click(within(panel).getByRole('radio', { name: 'Restaurant' }));
    await user.click(within(panel).getByRole('radio', { name: 'Accommodation' }));
    await user.click(within(panel).getByRole('radio', { name: 'Transportation' }));
    expect(within(panel).getByRole('radio', { name: 'Transportation' })).toBeChecked();
    expect(within(panel).getByRole('radio', { name: 'Accommodation' })).not.toBeChecked();
    expect(within(panel).getByRole('radio', { name: 'Attractions' })).not.toBeChecked();
    expect(within(panel).getByRole('button', { name: 'Save POI' })).toHaveTextContent('✓');
    expect(within(panel).getByRole('button', { name: 'Discard POI' })).toHaveTextContent('✕');
    await user.click(within(panel).getByRole('button', { name: 'Save POI' }));

    const stored = loadPoiReviews();
    expect(stored[poi.id]).toEqual(expect.objectContaining({
      editedName: 'Reviewed place', editedLocalizedName: '審核後景點', decision: 'Keep',
      categories: ['Transportation'], reviewStatus: 'reviewed',
    }));
    expect(within(pending).queryByRole('button', { name: `Review ${poi.name}` })).not.toBeInTheDocument();
    const reviewedMarker = screen.getByRole('button', { name: poi.name });
    expect(reviewedMarker).toHaveAttribute('data-review-status', 'reviewed');
    expect(reviewedMarker).toHaveAttribute('data-review-decision', 'keep');
    expect(within(reviewedMarker).getByTestId('poi-review-keep')).toBeInTheDocument();
  });

  it('stores Discard separately from raw POI data and reloads progress', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CountryExplorer data={data} />);
    const poi = cityPois[0]!;
    await user.click(screen.getByRole('button', { name: poi.name }));
    const panel = screen.getByRole('form', { name: 'POI review panel' });
    await user.click(within(panel).getByRole('button', { name: 'Discard POI' }));
    expect(data.pois?.find(({ id }) => id === poi.id)?.name).toBe(poi.name);
    expect(loadPoiReviews()[poi.id]).toEqual(expect.objectContaining({ decision: 'Discard', categories: [] }));

    unmount();
    render(<CountryExplorer data={data} />);
    expect(screen.getByText(`1 / ${cityPois.length} reviewed`)).toBeInTheDocument();
    const discardedMarker = screen.getByRole('button', { name: poi.name });
    expect(discardedMarker).toHaveAttribute('data-review-decision', 'discard');
    expect(within(discardedMarker).getByTestId('poi-review-discard')).toBeInTheDocument();
  });

  it('navigates through Europe country progress and Country city progress', async () => {
    window.history.replaceState(null, '', '#europe');
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    const countries = screen.getByRole('navigation', { name: 'Country POI review progress' });
    const country = data.countries.find((candidate) => data.cities.some((row) => row.countryId === candidate.id))!;
    await user.click(within(countries).getByRole('button', { name: new RegExp(`^${country.name}`) }));
    expect(window.location.hash).toBe(`#country/${country.id}`);
    const cities = screen.getByRole('navigation', { name: 'City POI review progress' });
    const target = data.cities.find((candidate) => candidate.countryId === country.id)!;
    await user.click(within(cities).getByRole('button', { name: new RegExp(`^${target.name}`) }));
    expect(window.location.hash).toBe(`#city/${target.id}`);
  });
});
