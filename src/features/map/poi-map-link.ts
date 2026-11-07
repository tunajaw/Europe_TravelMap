import type { TravelData } from '../../domain/travel-data.ts';

type PoiMapLinkInput = Pick<NonNullable<TravelData['pois']>[number], 'location'>;

export function googleMapsPoiUrl(poi: PoiMapLinkInput): string {
  const query = `${poi.location.latitude},${poi.location.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
