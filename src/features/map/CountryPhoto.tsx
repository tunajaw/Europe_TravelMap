import type { TravelData } from '../../domain/travel-data.ts';

// Reviewed display corrections; the original photo assets remain unchanged.
const invertedPhotos = new Set(['country-germany-02', 'country-lithuania-01', 'country-lithuania-02']);

export function CountryPhoto({ photo }: { photo: TravelData['photos'][number] }) {
  return <img src={`${import.meta.env.BASE_URL}${photo.path}`} alt={photo.altText}
    style={invertedPhotos.has(photo.id) ? { transform: 'rotate(180deg)' } : undefined} />;
}
