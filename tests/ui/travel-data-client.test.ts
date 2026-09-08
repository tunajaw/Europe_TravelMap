import { describe, expect, it, vi } from 'vitest';
import { loadTravelData } from '../../src/data/travel-data-client.ts';

const emptyDataset = {
  schemaVersion: '1.0.0',
  travelPeriod: { start: '2025-09-30', end: '2026-04-30' },
  countries: [],
  cities: [],
  airports: [],
  trips: [],
  segments: [],
  transfers: [],
  accommodations: [],
  photos: [],
};

describe('travel-data client', () => {
  it('loads and validates data from the GitHub Pages base path', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(emptyDataset)));

    await expect(loadTravelData('/Europe_TravelMap/', fetcher)).resolves.toEqual(emptyDataset);
    expect(fetcher).toHaveBeenCalledWith('/Europe_TravelMap/data/travel-data.json');
  });

  it('reports HTTP and schema failures', async () => {
    await expect(loadTravelData('/', async () => new Response('', { status: 404 })))
      .rejects.toThrow('404');
    await expect(loadTravelData('/', async () => new Response('{}')))
      .rejects.toThrow();
  });
});
