// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import source from '../../public/data/travel-data.json';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';
import { CountryExplorer } from '../../src/features/map/CountryExplorer.tsx';
import { europeProjection } from '../../src/features/map/country-label-layout.ts';

const data = TravelDataSchema.parse(source);
function expectedCities(countryId: string) {
  const own = new Set(data.cities.filter((city) => city.countryId === countryId).map((city) => city.id));
  const connected = new Set(data.segments.filter((segment) => segment.pathCityIds.some((id) => own.has(id))).flatMap((segment) => segment.pathCityIds));
  return data.cities.filter((city) => own.has(city.id) || connected.has(city.id));
}
beforeEach(() => window.history.replaceState(null, '', '/Europe_TravelMap/'));
afterEach(cleanup);

describe('FR-MAP-03/04 Country Map', () => {
  it.each(data.countries.map(({ id, name }) => ({ id, name })))('renders all reviewed cities for $name', ({ id }) => {
    window.history.replaceState(null, '', `#country/${id}`);
    render(<CountryExplorer data={data} />);
    expect(screen.getAllByTestId('city-marker')).toHaveLength(expectedCities(id).length);
    const [x, y, width, height] = screen.getByRole('group', { name: /country map$/ }).getAttribute('viewBox')!.split(' ').map(Number) as [number, number, number, number];
    for (const city of expectedCities(id)) {
      expect(screen.getByRole('img', { name: city.name })).toBeInTheDocument();
      const [cx, cy] = europeProjection([city.location.longitude, city.location.latitude])!;
      expect(cx).toBeGreaterThan(x);
      expect(cx).toBeLessThan(x + width);
      expect(cy).toBeGreaterThan(y);
      expect(cy).toBeLessThan(y + height);
    }
  });
  it('shows the country name and all its reviewed cities, with hover and keyboard emphasis', async () => {
    window.history.replaceState(null, '', '#country/germany');
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    const layer = screen.getByRole('group', { name: 'Visited Cities' });
    expect(within(layer).getAllByTestId('city-marker')).toHaveLength(expectedCities('germany').length);
    expect(container.querySelector('.country-map-name')).toHaveTextContent('Germany');
    const berlin = within(layer).getByRole('img', { name: 'Berlin' });
    await user.hover(berlin);
    expect(berlin).toHaveClass('city-marker--active');
    await user.unhover(berlin);
    expect(berlin).not.toHaveClass('city-marker--active');
    berlin.focus();
    expect(berlin).toHaveFocus();
    expect(within(layer).queryByRole('img', { name: 'Vatican City' })).not.toBeInTheDocument();
  });

  it('enters the double-clicked country directly, including when another country was selected', async () => {
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    await user.click(screen.getByRole('button', { name: 'Select Italy' }));
    await user.dblClick(screen.getByRole('button', { name: 'Select Germany' }));
    expect(window.location.hash).toBe('#country/germany');
    expect(screen.getByRole('group', { name: 'Germany country map' })).toBeInTheDocument();
  });

  it('returns to Europe and removes city markers without losing the photo-selection workflow', async () => {
    window.history.replaceState(null, '', '#country/italy');
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    expect(screen.getByRole('group', { name: 'Visited Cities' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Europe' }));
    expect(screen.queryByRole('group', { name: 'Visited Cities' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Europe travel map' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select Vatican City' }));
    await user.click(screen.getByRole('button', { name: 'Enter Vatican City' }));
    expect(within(screen.getByRole('group', { name: 'Visited Cities' })).getByRole('img', { name: 'Vatican City' })).toBeInTheDocument();
  });
});
