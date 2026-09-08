import { describe, expect, it } from 'vitest';
import travelDataSource from '../../public/data/travel-data.json';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  boxesOverlap,
  europeProjection,
  layoutCountryLabels,
} from '../../src/features/map/country-label-layout.ts';

const countries = TravelDataSchema.parse(travelDataSource).countries;

describe('country label layout', () => {
  it('keeps every reviewed country label inside the map without collisions', () => {
    const placements = layoutCountryLabels(countries, europeProjection);

    expect(placements).toHaveLength(countries.length);

    for (const placement of placements) {
      expect(placement.box.left).toBeGreaterThanOrEqual(0);
      expect(placement.box.top).toBeGreaterThanOrEqual(0);
      expect(placement.box.right).toBeLessThanOrEqual(MAP_WIDTH);
      expect(placement.box.bottom).toBeLessThanOrEqual(MAP_HEIGHT);
    }

    for (let leftIndex = 0; leftIndex < placements.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < placements.length; rightIndex += 1) {
        const left = placements[leftIndex]!;
        const right = placements[rightIndex]!;
        expect(
          boxesOverlap(left.box, right.box),
          `${left.countryId} overlaps ${right.countryId}`,
        ).toBe(false);
      }
    }
  });

  it('separates Spain and Andorra labels', () => {
    const placements = layoutCountryLabels(countries, europeProjection);
    const spain = placements.find((placement) => placement.countryId === 'spain');
    const andorra = placements.find((placement) => placement.countryId === 'andorra');

    expect(spain).toBeDefined();
    expect(andorra).toBeDefined();
    expect(boxesOverlap(spain!.box, andorra!.box)).toBe(false);
  });
});
