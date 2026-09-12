import { describe, expect, it } from 'vitest';
import { loadReferences } from '../../scripts/preprocess/references.ts';

describe('reviewed reference data', () => {
  it('loads only approved and internally consistent MVP references', async () => {
    const references = await loadReferences(process.cwd());

    expect(references.countries).toHaveLength(20);
    expect(references.cities).toHaveLength(76);
    expect(references.airports).toHaveLength(28);
    expect(references.index.aliases.size).toBe(102);
    expect(references.index.aliases.get('Skopje')?.cityId).toBe('city-skopje');
    expect(references.index.localTransfers.size).toBe(4);

    const italy = references.countries.find(({ id }) => id === 'italy');
    const milan = references.cities.find(({ id }) => id === 'city-milan');
    expect(italy?.capitalCity).toBe('Rome');
    expect(italy?.marker).toEqual(milan?.location);
  });
});
