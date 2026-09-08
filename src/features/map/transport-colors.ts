import type { TravelData } from '../../domain/travel-data.ts';

export const TRANSPORT_COLORS = {
  'High-speed Rail': '#780d25',
  Train: '#c65c82',
  'City Bus': '#a2d9b0',
  'InterCity Bus': '#34855b',
  Plane: '#254e85',
  'Ferry / Cruise': '#8bc8e5',
} satisfies Record<TravelData['segments'][number]['transportationCategory'], string>;

export const TRANSPORT_MODES = Object.entries(TRANSPORT_COLORS) as Array<[keyof typeof TRANSPORT_COLORS, string]>;
