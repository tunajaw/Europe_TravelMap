// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { TravelData } from '../../src/domain/travel-data.ts';
import { AccommodationBarplot } from '../../src/features/expense/AccommodationBarplot.tsx';
import type { AccommodationBarRow } from '../../src/features/expense/accommodation-data.ts';

afterEach(cleanup);

const rows = [
  { accommodationId: 'a-1', sequence: 1, cityId: 'salzburg', countryId: 'austria', type: 'Airbnb', label: 'Airbnb in Salzburg', nights: 2, pricePerNightEur: 30, commuteMinutes: 10, rating: { components: [1, .5, .75, .25, .5, .25, -.5], total: 2.75 }, notes: 'Quiet / Near station', nearestStationName: 'Salzburg Parsch', value: 30 },
  { accommodationId: 'h-1', sequence: 2, cityId: 'vienna', countryId: 'austria', type: 'Hotel', label: 'Hotel in Vienna', nights: 1, pricePerNightEur: 60, commuteMinutes: 20, rating: { components: [1, 1, 0, .5, .5, .5, 0], total: 3.5 }, notes: null, nearestStationName: 'Wien Hauptbahnhof', value: 60 },
] as AccommodationBarRow[];
const cities = [{ id: 'salzburg', name: 'Salzburg' }, { id: 'vienna', name: 'Vienna' }] as TravelData['cities'];

describe('Accommodation barplot (FR-EXP-12 and FR-EXP-13)', () => {
  it('renders one colored horizontal bar per Accommodation', () => {
    render(<AccommodationBarplot cities={cities} metric="nightly-price" rows={rows} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Select Salzburg · Airbnb/ })).toHaveTextContent('€ 30.00 / night');
  });

  it('previews metadata, locks it on click, and shows the other metric', async () => {
    const user = userEvent.setup();
    render(<AccommodationBarplot cities={cities} metric="nightly-price" rows={rows} />);
    const salzburg = screen.getByRole('button', { name: /Select Salzburg · Airbnb/ });
    const vienna = screen.getByRole('button', { name: /Select Vienna · Hotel/ });

    await user.click(salzburg);
    await user.unhover(salzburg);
    expect(salzburg).toHaveAttribute('aria-pressed', 'true');
    const details = screen.getByRole('region', { name: 'Salzburg Airbnb details' });
    expect(details).toHaveTextContent('Commute10 min');
    expect(details).toHaveTextContent('Nearest stationSalzburg Parsch');
    expect(details).toHaveTextContent('2.75 / 5 stars');
    const priceMeter = screen.getByLabelText('價錢: 0.75 (0 to 1)');
    expect(priceMeter.querySelectorAll(':scope > span')).toHaveLength(4);
    expect(priceMeter.querySelectorAll('.is-positive-filled')).toHaveLength(3);
    expect(screen.getByLabelText('其他加分: -0.5 (-1 to 0.5)').querySelectorAll('.is-negative-filled')).toHaveLength(2);
    expect(screen.getByText('Quiet')).toBeVisible();
    expect(screen.getByText('Near station')).toBeVisible();

    await user.hover(vienna);
    expect(screen.getByRole('region', { name: 'Vienna Hotel details' })).toBeVisible();
    await user.unhover(vienna);
    expect(screen.getByRole('region', { name: 'Salzburg Airbnb details' })).toBeVisible();
  });

  it('keeps low-rated Commute bars colored and visible after Rating sorting', () => {
    const lowRatedRows = [
      { accommodationId: 'amsterdam', sequence: 37, cityId: 'amsterdam', countryId: 'netherlands', type: 'Hostel', label: 'Hostel in Amsterdam', nights: 2, pricePerNightEur: 36, commuteMinutes: 15, rating: { components: [1, .5, .25, .5, 0, .25, -.25], total: 2.25 }, notes: null, nearestStationName: 'IJTunnel', value: 15 },
      { accommodationId: 'frankfurt', sequence: 20, cityId: 'frankfurt', countryId: 'germany', type: 'Airbnb', label: 'Airbnb in Frankfurt', nights: 2, pricePerNightEur: 34, commuteMinutes: 35, rating: { components: [1, 1, .5, 0, .25, .25, -1], total: 2 }, notes: null, nearestStationName: 'Kelsterbach', value: 35 },
      { accommodationId: 'salzburg-hostel', sequence: 2, cityId: 'salzburg', countryId: 'austria', type: 'Hostel', label: 'Hostel in Salzburg', nights: 1, pricePerNightEur: 30, commuteMinutes: 10, rating: { components: [1, 0, .5, .5, 0, 0, -.5], total: 1.5 }, notes: null, nearestStationName: 'Salzburg Hauptbahnhof', value: 10 },
    ] as AccommodationBarRow[];
    const lowRatedCities = [
      { id: 'amsterdam', name: 'Amsterdam' },
      { id: 'frankfurt', name: 'Frankfurt' },
      { id: 'salzburg', name: 'Salzburg' },
    ] as TravelData['cities'];
    render(<AccommodationBarplot cities={lowRatedCities} metric="commute" rows={lowRatedRows} />);

    const expected = [
      ['Amsterdam', '42.857142857142854%', 'rgb(158, 214, 177)'],
      ['Frankfurt', '100%', 'rgb(233, 165, 169)'],
      ['Salzburg', '28.57142857142857%', 'rgb(158, 214, 177)'],
    ];
    for (const [city, width, color] of expected) {
      const button = screen.getByRole('button', { name: new RegExp(`Select ${city}`) });
      const fill = button.querySelector<HTMLElement>('.accommodation-bar-fill')!;
      expect(fill.style.width).toBe(width);
      expect(fill.style.minWidth).toBe('4px');
      expect(fill.style.backgroundColor).toBe(color);
    }
  });

  it('renders a checked Airport Accommodation as a yellow zero-price marker', async () => {
    const user = userEvent.setup();
    const airport = [{ accommodationId: 'airport', sequence: 1, cityId: 'london', countryId: 'uk', type: 'Airport',
      label: 'Airport in London', nights: 1, pricePerNightEur: 0, commuteMinutes: null,
      rating: { components: [.5, 0, 0, 0, .5], total: 1 }, notes: null, nearestStationName: null, value: 0 }] as AccommodationBarRow[];
    const london = [{ id: 'london', name: 'London' }] as TravelData['cities'];
    render(<AccommodationBarplot cities={london} metric="nightly-price" rows={airport} />);

    const fill = screen.getByRole('button', { name: /Select London · Airport, € 0.00/ })
      .querySelector<HTMLElement>('.accommodation-bar-fill')!;
    expect(fill.style.minWidth).toBe('8px');
    expect(fill.style.backgroundColor).toBe('rgb(228, 191, 98)');
    await user.click(screen.getByRole('button', { name: /Select London · Airport/ }));
    expect(screen.getByRole('region', { name: 'London Airport details' }))
      .toHaveTextContent('Nearest station-');
  });
});
