import type { TravelData } from '../../domain/travel-data.ts';

type AccommodationType = TravelData['accommodations'][number]['type'];

export interface AccommodationRatingDimension {
  label: string;
  minimum: number;
  maximum: number;
  step: number;
}

const STANDARD_RUBRIC: readonly AccommodationRatingDimension[] = [
  { label: '安全入住', minimum: 0, maximum: 1, step: 1 },
  { label: '隔音', minimum: 0, maximum: 1, step: 0.5 },
  { label: '價錢', minimum: 0, maximum: 1, step: 0.25 },
  { label: '地理方便', minimum: 0, maximum: 0.5, step: 0.25 },
  { label: '有無浴室用品', minimum: 0, maximum: 0.5, step: 0.25 },
  { label: '私人空間', minimum: 0, maximum: 0.5, step: 0.25 },
  { label: '其他加分', minimum: -1, maximum: 0.5, step: 0.25 },
];

const AIRPORT_RUBRIC: readonly AccommodationRatingDimension[] = [
  { label: '睡眠品質', minimum: 0, maximum: 2, step: 0.5 },
  { label: '椅子品質', minimum: 0, maximum: 1, step: 0.5 },
  { label: '溫度', minimum: 0, maximum: 1, step: 1 },
  { label: '有沒有大喇叭', minimum: 0, maximum: 0.5, step: 0.5 },
  { label: '充電器', minimum: 0, maximum: 0.5, step: 0.5 },
];

export function accommodationRatingRubric(type: AccommodationType): readonly AccommodationRatingDimension[] {
  return type === 'Airport' ? AIRPORT_RUBRIC : STANDARD_RUBRIC;
}

export function ratingCellCounts(value: number, dimension: AccommodationRatingDimension) {
  const negativeTotal = Math.round(Math.abs(Math.min(0, dimension.minimum)) / dimension.step);
  const positiveTotal = Math.round(Math.max(0, dimension.maximum) / dimension.step);
  return {
    negativeFilled: value < 0 ? Math.min(negativeTotal, Math.round(Math.abs(value) / dimension.step)) : 0,
    negativeTotal,
    positiveFilled: value > 0 ? Math.min(positiveTotal, Math.round(value / dimension.step)) : 0,
    positiveTotal,
  };
}
