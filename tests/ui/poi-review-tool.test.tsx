// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import source from '../../public/data/travel-data.json';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';
import { CountryExplorer } from '../../src/features/map/CountryExplorer.tsx';
import {
  POI_REVIEW_STORAGE_KEY,
  loadPoiReviews,
  parsePoiReviewFile,
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
  it('serializes, reloads, and upserts one record per POI ID', () => {
    const first: PoiReviewRecord = {
      poiId: 'poi-1', editedName: 'First', decision: 'Keep', categories: ['Attractions'],
      reviewStatus: 'reviewed', updatedAt: '2026-10-22T00:00:00.000Z',
    };
    const second = { ...first, editedName: 'Updated', decision: 'Discard' as const, categories: [] };
    const reviews = upsertPoiReview(upsertPoiReview({}, first), second);
    expect(Object.keys(reviews)).toEqual(['poi-1']);
    const restored = parsePoiReviewFile(serializePoiReviews(reviews, '2026-10-22T01:00:00.000Z'));
    expect(restored['poi-1']).toEqual(second);
  });

  it('opens a review panel from a POI, keeps an edited record, and updates the pending list', async () => {
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    const poi = cityPois[0]!;
    const pending = screen.getByRole('navigation', { name: 'Unreviewed POIs' });
    expect(within(pending).getAllByRole('button')).toHaveLength(cityPois.length);
    const map = screen.getByRole('group', { name: `${city.name} city map` });
    const initialBounds = map.getAttribute('data-geo-bounds');

    await user.click(within(pending).getByRole('button', { name: `Review ${poi.name}` }));
    expect(map).not.toHaveAttribute('data-geo-bounds', initialBounds);
    const panel = screen.getByRole('form', { name: 'POI review panel' });
    const name = within(panel).getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue(poi.name);
    expect(within(panel).getByRole('checkbox', { name: 'Attractions' })).toBeChecked();
    await user.clear(name);
    await user.type(name, 'Reviewed place');
    await user.click(within(panel).getByRole('checkbox', { name: 'Restaurant' }));
    await user.click(within(panel).getByRole('button', { name: 'Save review' }));

    const stored = loadPoiReviews();
    expect(stored[poi.id]).toEqual(expect.objectContaining({
      editedName: 'Reviewed place', decision: 'Keep', categories: ['Attractions', 'Restaurant'], reviewStatus: 'reviewed',
    }));
    expect(within(pending).queryByRole('button', { name: `Review ${poi.name}` })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: poi.name })).toHaveAttribute('data-review-status', 'reviewed');
  });

  it('stores Discard separately from raw POI data and reloads progress', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CountryExplorer data={data} />);
    const poi = cityPois[0]!;
    await user.click(screen.getByRole('button', { name: poi.name }));
    const panel = screen.getByRole('form', { name: 'POI review panel' });
    await user.click(within(panel).getByRole('radio', { name: 'Discard' }));
    await user.click(within(panel).getByRole('button', { name: 'Save review' }));
    expect(data.pois?.find(({ id }) => id === poi.id)?.name).toBe(poi.name);
    expect(loadPoiReviews()[poi.id]).toEqual(expect.objectContaining({ decision: 'Discard', categories: [] }));

    unmount();
    render(<CountryExplorer data={data} />);
    expect(screen.getByText(`1 / ${cityPois.length} reviewed`)).toBeInTheDocument();
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
