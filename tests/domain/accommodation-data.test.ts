import { describe, expect, it } from 'vitest';
import type { TravelData } from '../../src/domain/travel-data.ts';
import {
  accommodationScaleMaximum,
  buildAccommodationBarRows,
  buildAccommodationCategorySummaries,
  buildAccommodationHeatmapRows,
} from '../../src/features/expense/accommodation-data.ts';

const rating = { components: [1, 1], total: 2 };
const accommodations = [
  { id: 'a-1', sequence: 1, cityId: 'x', countryId: 'a', type: 'Airbnb', label: 'A1', nights: 2, pricePerNightEur: 30, totalCostEur: 60, commuteMinutes: 10, rating, notes: null, nearestStationName: 'Station A' },
  { id: 'a-2', sequence: 2, cityId: 'x', countryId: 'a', type: 'Airbnb', label: 'A2', nights: 1, pricePerNightEur: 60, totalCostEur: 60, commuteMinutes: 40, rating, notes: 'note', nearestStationName: 'Station B' },
  { id: 'h-1', sequence: 3, cityId: 'y', countryId: 'b', type: 'Hotel', label: 'H1', nights: 1, pricePerNightEur: 40, totalCostEur: 40, commuteMinutes: 20, rating, notes: null, nearestStationName: 'Station C' },
  { id: 'airport', sequence: 4, cityId: 'y', countryId: 'b', type: 'Airport', label: 'Airport', nights: 1, pricePerNightEur: 0, totalCostEur: 0, commuteMinutes: null, rating, notes: null, nearestStationName: null },
] as TravelData['accommodations'];

describe('Accommodation expense data', () => {
  it('calculates category summaries using nights as weights', () => {
    const airbnb = buildAccommodationCategorySummaries(accommodations)[0]!;
    expect(airbnb).toMatchObject({
      category: 'Airbnb', totalCostEur: 120, averageNightlyCostEur: 40, averageCommuteMinutes: 20,
    });
  });

  it('renders one row per applicable Accommodation and never treats Airport commute as zero', () => {
    const priceRows = buildAccommodationBarRows(accommodations, {
      categories: ['Airbnb', 'Hotel'], includeAirport: true, metric: 'nightly-price', sort: 'ascending',
    });
    expect(priceRows.map(({ accommodationId, value }) => [accommodationId, value]))
      .toEqual([['airport', 0], ['a-1', 30], ['h-1', 40], ['a-2', 60]]);

    const commuteRows = buildAccommodationBarRows(accommodations, {
      categories: ['Airbnb', 'Hotel'], includeAirport: true, metric: 'commute', sort: 'chronological',
    });
    expect(commuteRows.map(({ accommodationId }) => accommodationId)).toEqual(['a-1', 'a-2', 'h-1']);
  });

  it('includes Airport nights in price aggregation but excludes them from commute aggregation', () => {
    const price = buildAccommodationHeatmapRows(accommodations, {
      categories: ['Airbnb', 'Hotel'], includeAirport: true, metric: 'nightly-price',
    });
    expect(price.find(({ countryId }) => countryId === 'b')).toMatchObject({ nights: 2, average: 20 });

    const commute = buildAccommodationHeatmapRows(accommodations, {
      categories: ['Airbnb', 'Hotel'], includeAirport: true, metric: 'commute',
    });
    expect(commute.find(({ countryId }) => countryId === 'b')).toMatchObject({ nights: 1, average: 20 });
  });

  it('uses a stable scale that can cover every filtered weighted average', () => {
    expect(accommodationScaleMaximum(accommodations, 'nightly-price')).toBe(60);
    expect(accommodationScaleMaximum(accommodations, 'commute')).toBe(40);
  });

  it('sorts by total rating from highest to lowest and breaks ties chronologically', () => {
    const rated = accommodations.map((row, index) => ({
      ...row,
      rating: { ...row.rating, total: [3, 4, 4, 1][index]! },
    })) as TravelData['accommodations'];
    const rows = buildAccommodationBarRows(rated, {
      categories: ['Airbnb', 'Hotel'], includeAirport: false, metric: 'nightly-price', sort: 'rating',
    });

    expect(rows.map(({ accommodationId }) => accommodationId)).toEqual(['a-2', 'h-1', 'a-1']);
  });
});
