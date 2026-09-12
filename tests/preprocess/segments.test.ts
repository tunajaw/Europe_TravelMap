import { describe, expect, it } from 'vitest';

import { preprocessSegments } from '../../scripts/preprocess/segments.ts';
import { haversineKm, roundedKm } from '../../scripts/preprocess/geo.ts';
import type { ReferenceIndex } from '../../scripts/preprocess/types.ts';

const references: ReferenceIndex = {
  aliases: new Map([
    ['M. Hbf.', { cityId: 'city-munich', airportId: null }],
    ['Salzburg Hbf.', { cityId: 'city-salzburg', airportId: null }],
    ['Königssee', { cityId: 'city-konigssee', airportId: null }],
  ]),
  cities: new Map([
    ['city-munich', { latitude: 48.1407, longitude: 11.5569, countryId: 'country-germany' }],
    ['city-salzburg', { latitude: 47.8131, longitude: 13.0459, countryId: 'country-austria' }],
    ['city-konigssee', { latitude: 47.5922, longitude: 12.9875, countryId: 'country-germany' }],
  ]),
  airports: new Map(),
  localTransfers: new Map(),
};

describe('Segment preprocessing', () => {
  it('sums ordered Transit Point legs even when origin and destination differ', () => {
    const result = preprocessSegments([{
      Trip: 'Transit test', 起點: 'M. Hbf.', 終點: 'Salzburg Hbf.', 日期: '9 October, 2025',
      價錢: '€10', '接駁(出發)': '0', '接駁(到達)': '0', 交通工具: '火車', 品牌: 'DB', 備註: '//',
      'Transit Point': 'Königssee',
    }], references);
    expect(result.segments[0]!.baseDistanceKm).toBe(roundedKm(
      haversineKm(references.cities.get('city-munich')!, references.cities.get('city-konigssee')!)
      + haversineKm(references.cities.get('city-konigssee')!, references.cities.get('city-salzburg')!),
    ));
  });
  it('fills down Trip, preserves sequence, maps locations, and splits Transit Points', () => {
    const result = preprocessSegments(
      [
        {
          Trip: 'Austria', 起點: 'M. Hbf.', 終點: 'Salzburg Hbf.', 日期: '9 October, 2025',
          價錢: '0', '接駁(出發)': '0', '接駁(到達)': '0', 交通工具: '火車', 品牌: 'DB', 備註: '//',
          'Transit Point': '',
        },
        {
          Trip: '', 起點: 'Salzburg Hbf.', 終點: 'Salzburg Hbf.', 日期: '10 October, 2025',
          價錢: '€3.4', '接駁(出發)': '0', '接駁(到達)': '0', 交通工具: '公車', 品牌: 'RVO', 備註: '//',
          'Transit Point': ' Königssee,  ',
        },
      ],
      references,
    );

    expect(result.trips).toEqual([
      expect.objectContaining({ id: 'trip-001', title: 'Austria', segmentIds: ['segment-001', 'segment-002'] }),
    ]);
    expect(result.segments[1]).toEqual(expect.objectContaining({
      tripId: 'trip-001',
      sequence: 2,
      originCityId: 'city-salzburg',
      destinationCityId: 'city-salzburg',
      transitCityIds: ['city-konigssee'],
      transportationCategory: 'City Bus',
      date: '2025-10-10',
    }));
    expect(result.segments[1]?.baseDistanceKm).toBeGreaterThan(30);
  });

  it('rejects a blank Trip before the first Trip title', () => {
    expect(() => preprocessSegments([
      {
        Trip: '', 起點: 'M. Hbf.', 終點: 'Salzburg Hbf.', 日期: '9 October, 2025',
        價錢: '0', '接駁(出發)': '0', '接駁(到達)': '0', 交通工具: '火車', 品牌: 'DB', 備註: '//',
        'Transit Point': '',
      },
    ], references)).toThrow(/Trip/i);
  });

  it('derives an always-included local Transfer distance from reviewed route endpoints', () => {
    const localReferences: ReferenceIndex = {
      ...references,
      localTransfers: new Map([['transfer-001-departure', {
        start: { name: 'Munich Central', latitude: 48.1407, longitude: 11.5569 },
        end: { name: 'Munich Coach Station', latitude: 48.1426, longitude: 11.5481 },
      }]]),
    };
    const result = preprocessSegments([{
      Trip: 'Local transfer', 起點: 'M. Hbf.', 終點: 'Salzburg Hbf.', 日期: '9 October, 2025',
      價錢: '€10', '接駁(出發)': '€2', '接駁(到達)': '0', 交通工具: '客運', 品牌: 'Example',
      備註: '/Local bus/', 'Transit Point': '',
    }], localReferences);

    expect(result.transfers[0]).toEqual(expect.objectContaining({
      endpointKind: 'local',
      expenseInclusion: 'always',
      distanceKm: expect.any(Number),
      localRoute: localReferences.localTransfers.get('transfer-001-departure'),
    }));
  });
});
