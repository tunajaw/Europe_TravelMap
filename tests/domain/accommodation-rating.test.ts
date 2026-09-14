import { describe, expect, it } from 'vitest';
import { accommodationRatingRubric, ratingCellCounts } from '../../src/features/expense/accommodation-rating.ts';

describe('Accommodation rating rubric', () => {
  it('maps a 0.75 Price rating to three of four cells', () => {
    const price = accommodationRatingRubric('Hotel').find(({ label }) => label === '價錢')!;
    expect(ratingCellCounts(0.75, price)).toEqual({
      negativeFilled: 0,
      negativeTotal: 0,
      positiveFilled: 3,
      positiveTotal: 4,
    });
  });

  it('maps negative Other bonus values away from the zero midpoint', () => {
    const bonus = accommodationRatingRubric('Airbnb').find(({ label }) => label === '其他加分')!;
    expect(ratingCellCounts(-0.5, bonus)).toEqual({
      negativeFilled: 2,
      negativeTotal: 4,
      positiveFilled: 0,
      positiveTotal: 2,
    });
  });

  it('uses the five-component Airport rubric', () => {
    expect(accommodationRatingRubric('Airport').map(({ label }) => label)).toEqual([
      '睡眠品質', '椅子品質', '溫度', '有沒有大喇叭', '充電器',
    ]);
  });
});
