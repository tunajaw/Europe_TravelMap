import { describe, expect, it } from 'vitest';

import { preprocessAccommodations } from '../../scripts/preprocess/accommodations.ts';

const tripIds = new Map([['Poland and Milan', 'trip-001']]);
const cityIds = new Map([
  ['Kraków', { id: 'city-krakow', countryId: 'country-poland' }],
  ['Milan', { id: 'city-milan', countryId: 'country-italy' }],
]);

describe('Accommodation preprocessing', () => {
  it('normalizes City, typed values, and excludes source addresses', () => {
    const [result] = preprocessAccommodations([
      {
        Trip: 'Poland and Milan',
        住宿地址: 'private fixture address',
        住宿城市: 'Krakow',
        住宿類型: 'Hotel',
        備註: '',
        '價錢/晚': '€30.5',
        原始評分: '1/1/0.5/0.5/0.5/0.5/0.25: 4.25',
        '名稱(如有)': 'Fixture Hotel',
        晚數: '2',
        通勤時間: '15 min',
      },
    ], tripIds, cityIds);

    expect(result).toEqual(expect.objectContaining({
      tripId: 'trip-001',
      cityId: 'city-krakow',
      countryId: 'country-poland',
      pricePerNightEur: 30.5,
      nights: 2,
      totalCostEur: 61,
      commuteMinutes: 15,
    }));
    expect(JSON.stringify(result)).not.toContain('private fixture address');
  });

  it('uses null commute for Airport accommodation', () => {
    const [result] = preprocessAccommodations([
      {
        Trip: 'Poland and Milan', 住宿地址: 'private fixture address', 住宿城市: 'Milan ',
        住宿類型: 'Airport', 備註: '', '價錢/晚': '0', 原始評分: '1/1/1/0/0: 3',
        '名稱(如有)': 'BGY Airport', 晚數: '1', 通勤時間: '0',
      },
    ], tripIds, cityIds);

    expect(result?.cityId).toBe('city-milan');
    expect(result?.commuteMinutes).toBeNull();
  });
});
