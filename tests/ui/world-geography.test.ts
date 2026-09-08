import { describe, expect, it } from 'vitest';
import travelDataSource from '../../public/data/travel-data.json';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';
import { worldCountries } from '../../src/features/map/world-geography.ts';

describe('Europe Map geographic boundary contract', () => {
  it('maps every MVP Country to a stable Natural Earth boundary', () => {
    const travelData = TravelDataSchema.parse(travelDataSource);
    const boundaryIds = new Set(worldCountries.features.map(({ id }) => String(id).padStart(3, '0')));

    for (const country of travelData.countries.filter(({ isMicrostate }) => !isMicrostate)) {
      expect(boundaryIds, country.name).toContain(country.boundaryId);
    }
  });
});
