import { describe, expect, it } from 'vitest';
import { matchesAddress } from '../../scripts/station-address-match.ts';

describe('Station lookup address matching', () => {
  it('requires both street and full house number', () => {
    expect(matchesAddress('Example Road 12, Test City', { street: 'Example Road', housenumber: '12' })).toBe(true);
    expect(matchesAddress('Example Road 120, Test City', { street: 'Example Road', housenumber: '12' })).toBe(false);
    expect(matchesAddress('Other Road 12, Test City', { street: 'Example Road', housenumber: '12' })).toBe(false);
    expect(matchesAddress('Example Road 12', { street: 'Example Road' })).toBe(false);
  });
});
