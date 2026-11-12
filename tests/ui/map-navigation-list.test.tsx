// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import source from '../../public/data/travel-data.json';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';
import { CountryExplorer } from '../../src/features/map/CountryExplorer.tsx';
import { googleMapsPoiUrl } from '../../src/features/map/poi-map-link.ts';

const data = TravelDataSchema.parse(source);
const city = data.cities.find((candidate) => (data.pois ?? []).some((poi) => poi.cityId === candidate.id))!;
const country = data.countries.find(({ id }) => id === city.countryId)!;
const cityPois = (data.pois ?? []).filter((poi) => poi.cityId === city.id);

beforeEach(() => {
  window.history.replaceState(null, '', '#europe');
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('map navigation lists', () => {
  it('scrolls only the POI list to a selected map marker and preserves the map viewport', async () => {
    window.history.replaceState(null, '', `#city/${city.id}`);
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    const poi = cityPois.at(-1)!;
    const button = screen.getByRole('button', { name: `Focus ${poi.name}` });
    const item = button.closest('.city-poi-dashboard-item') as HTMLElement;
    const list = item.parentElement!;
    const scroll = vi.fn();
    Object.defineProperty(list, 'scrollTo', { configurable: true, value: scroll });
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 200 });
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 300 } as DOMRect);
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({ top: 600, bottom: 650, height: 50 } as DOMRect);
    const map = screen.getByRole('group', { name: `${city.name} city map` });
    const bounds = map.getAttribute('data-geo-bounds');
    const marker = within(map).getByRole('button', { name: poi.name });
    await user.hover(marker);
    expect(scroll).not.toHaveBeenCalled();
    await user.click(marker);
    expect(scroll).toHaveBeenCalledWith({ top: 425, behavior: 'instant' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(map).toHaveAttribute('data-geo-bounds', bounds!);
    await user.click(marker);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('keeps a Country list beside Europe Map and a City list beside Country Map', async () => {
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    const countries = screen.getByRole('navigation', { name: 'Country list' });
    await user.click(within(countries).getByRole('button', { name: new RegExp(`^Open ${country.name}`) }));
    expect(window.location.hash).toBe(`#country/${country.id}`);

    const cities = screen.getByRole('navigation', { name: 'City list' });
    await user.click(within(cities).getByRole('button', { name: new RegExp(`^Open ${city.name}`) }));
    expect(window.location.hash).toBe(`#city/${city.id}`);
  });

  it('lists every reviewed POI in City Map and focuses one from the list', async () => {
    window.history.replaceState(null, '', `#city/${city.id}`);
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    const list = screen.getByRole('navigation', { name: 'POI list' });
    expect(within(list).getAllByRole('button')).toHaveLength(cityPois.length);
    const map = screen.getByRole('group', { name: `${city.name} city map` });
    const dashboard = screen.getByRole('complementary', { name: 'Journey dashboard' });
    expect(dashboard).toContainElement(list);
    expect(map.closest('.map-panel')).not.toContainElement(list);
    expect(map.closest('.city-review-layout')).toBeNull();
    const poi = cityPois[0]!;
    const item = within(list).getByRole('button', { name: `Focus ${poi.name}` })
      .closest('.city-poi-dashboard-item') as HTMLElement;
    expect(item).toHaveClass(`city-poi-dashboard-item--${poi.category.toLowerCase()}`);
    expect(within(item).getByText(poi.category)).toBeInTheDocument();
    expect(within(item).getByRole('link', { name: `Open ${poi.name} in Google Maps` }))
      .toHaveAttribute('href', googleMapsPoiUrl(poi));

    await user.click(within(item).getByRole('button', { name: `Focus ${poi.name}` }));
    expect(within(screen.getByRole('region', { name: 'POI metadata' })).getByText(poi.name))
      .toBeInTheDocument();
  });
});
