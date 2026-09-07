import { describe, expect, it } from 'vitest';
import { TravelDataSchema, assertReferentialIntegrity } from '../../src/domain/travel-data.ts';

describe('public application-data contract', () => {
  it('rejects unexpected fields that could leak raw data', () => {
    expect(() => TravelDataSchema.parse({
      schemaVersion: '1.0.0',
      travelPeriod: { start: '2025-09-30', end: '2026-04-30' },
      countries: [], cities: [], airports: [], trips: [], segments: [], transfers: [], photos: [],
      accommodations: [{ 住宿地址: 'private' }],
    })).toThrow();
  });

  it('rejects broken cross-entity references', () => {
    const data = TravelDataSchema.parse({
      schemaVersion: '1.0.0',
      travelPeriod: { start: '2025-09-30', end: '2026-04-30' },
      countries: [], cities: [], airports: [], trips: [], segments: [], transfers: [], accommodations: [],
      photos: [{
        id: 'photo-1', countryId: 'missing', path: 'images/example.webp', displayOrder: 1,
        candidateCityId: null, altText: 'Example',
      }],
    });
    expect(() => assertReferentialIntegrity(data)).toThrow('Broken Photo Country');
  });

  it('rejects Segment paths whose endpoints contradict the Segment', () => {
    const data = TravelDataSchema.parse({
      schemaVersion: '1.0.0',
      travelPeriod: { start: '2025-09-30', end: '2026-04-30' },
      countries: [{
        id: 'country-a', name: 'A', slug: 'a', capitalCity: 'A', isMicrostate: false,
        marker: { latitude: 0, longitude: 0 }, photoIds: ['p1', 'p2', 'p3'],
      }],
      cities: [
        { id: 'city-a', name: 'A', countryId: 'country-a', referencePointName: 'A', referencePointType: 'station', location: { latitude: 0, longitude: 0 } },
        { id: 'city-b', name: 'B', countryId: 'country-a', referencePointName: 'B', referencePointType: 'station', location: { latitude: 1, longitude: 1 } },
      ],
      airports: [],
      trips: [{ id: 'trip-1', title: 'Trip', sequence: 1, firstDate: '2025-10-01', lastDate: '2025-10-01', segmentIds: ['segment-1'] }],
      segments: [{
        id: 'segment-1', tripId: 'trip-1', sequence: 1, globalSequence: 1, date: '2025-10-01',
        originCityId: 'city-a', destinationCityId: 'city-b', originCountryId: 'country-a', destinationCountryId: 'country-a',
        transitCityIds: [], pathCityIds: ['city-b', 'city-a'], transportationSubtype: '火車',
        transportationCategory: 'Train', company: null, baseCostEur: 0, baseDistanceKm: 1,
        notes: null, departureTransferId: null, arrivalTransferId: null,
      }],
      transfers: [], accommodations: [],
      photos: [1, 2, 3].map((displayOrder) => ({
        id: `p${displayOrder}`, countryId: 'country-a', path: `images/p${displayOrder}.webp`,
        displayOrder, candidateCityId: null, altText: 'Example',
      })),
    });
    expect(() => assertReferentialIntegrity(data)).toThrow('path endpoints');
  });
});
