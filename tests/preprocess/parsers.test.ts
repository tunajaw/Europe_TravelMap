import { describe, expect, it } from 'vitest';

import {
  parseDate,
  parseDurationMinutes,
  parseMoney,
  parseRating,
  splitSegmentNotes,
} from '../../scripts/preprocess/parsers.ts';

describe('source value parsers', () => {
  it.each([
    ['0', 0],
    ['€3.4', 3.4],
    ['€ 27.54', 27.54],
    [' €19.99 ', 19.99],
  ])('parses EUR money %s', (source, expected) => {
    expect(parseMoney(source)).toBe(expected);
  });

  it('rejects unsupported money formats', () => {
    expect(() => parseMoney('$10')).toThrow(/money/i);
  });

  it.each([
    ['25min', 25],
    ['5 min', 5],
    ['0', 0],
  ])('parses duration %s', (source, expected) => {
    expect(parseDurationMinutes(source)).toBe(expected);
  });

  it('serializes English source dates as ISO dates', () => {
    expect(parseDate('9 October, 2025')).toBe('2025-10-09');
  });

  it('preserves all three note positions', () => {
    expect(splitSegmentNotes('/Flixbus, 20% OFF/')).toEqual({
      segment: null,
      departure: 'Flixbus, 20% OFF',
      arrival: null,
    });
  });

  it('accepts both colon and arrow rating separators', () => {
    expect(parseRating('1/1/0.5/0.5/0.5/0.5/0.25: 4.25')).toEqual({
      components: [1, 1, 0.5, 0.5, 0.5, 0.5, 0.25],
      total: 4.25,
    });
    expect(parseRating('1/1/0.5/0.25/0.5/0.5/0.25 → 4')).toEqual({
      components: [1, 1, 0.5, 0.25, 0.5, 0.5, 0.25],
      total: 4,
    });
  });

  it('rejects a rating whose total does not equal its components', () => {
    expect(() => parseRating('1/1/1: 2')).toThrow(/rating total/i);
  });
});
