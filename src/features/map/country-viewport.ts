import { geoStream } from 'd3-geo';
import type { TravelData } from '../../domain/travel-data.ts';
import { europeProjection, MAP_HEIGHT, MAP_WIDTH } from './country-label-layout.ts';
import { worldCountries } from './world-geography.ts';

export const EUROPE_VIEWPORT: [number, number, number, number] = [160, 90, 950, 555];
export type MapViewport = [number, number, number, number];

export function zoomMapViewportAtPoint(
  viewport: MapViewport,
  initialViewport: MapViewport,
  anchorX: number,
  anchorY: number,
  factor: number,
): MapViewport {
  const minimumWidth = initialViewport[2] * 0.2;
  const width = Math.min(initialViewport[2], Math.max(minimumWidth, viewport[2] * factor));
  const height = width * initialViewport[3] / initialViewport[2];
  if (width >= initialViewport[2]) return [...initialViewport];

  const horizontalAnchor = Math.min(1, Math.max(0, (anchorX - viewport[0]) / viewport[2]));
  const verticalAnchor = Math.min(1, Math.max(0, (anchorY - viewport[1]) / viewport[3]));
  const unclampedX = anchorX - horizontalAnchor * width;
  const unclampedY = anchorY - verticalAnchor * height;
  const maximumX = initialViewport[0] + initialViewport[2] - width;
  const maximumY = initialViewport[1] + initialViewport[3] - height;
  return [
    Math.min(maximumX, Math.max(initialViewport[0], unclampedX)),
    Math.min(maximumY, Math.max(initialViewport[1], unclampedY)),
    width,
    height,
  ];
}

export function countryViewport(country: TravelData['countries'][number] | undefined, cities: TravelData['cities'] = []): MapViewport {
  if (!country) return EUROPE_VIEWPORT;
  const center = europeProjection([country.marker.longitude, country.marker.latitude])!;
  const points: number[][] = [center, ...cities.map((city) => europeProjection([city.location.longitude, city.location.latitude])!)];
  const boundary = worldCountries.features.find((feature) => String(feature.id).padStart(3, '0') === country.boundaryId);
  if (boundary) geoStream(boundary, {
    point(longitude, latitude) {
      const point = europeProjection([longitude, latitude]);
      // Exclude overseas territories outside the Europe overview.
      if (point && point[0] >= 0 && point[0] <= MAP_WIDTH && point[1] >= 0 && point[1] <= MAP_HEIGHT) points.push(point);
    },
    lineStart() {}, lineEnd() {}, polygonStart() {}, polygonEnd() {}, sphere() {},
  });
  const xs = points.map((point) => point[0]!);
  const ys = points.map((point) => point[1]!);
  const left = Math.min(...xs), right = Math.max(...xs);
  const top = Math.min(...ys), bottom = Math.max(...ys);
  const width = Math.max(140, (right - left) * 1.25, (bottom - top) * MAP_WIDTH / MAP_HEIGHT * 1.25);
  const height = width * MAP_HEIGHT / MAP_WIDTH;
  return [(left + right - width) / 2, (top + bottom - height) / 2, width, height];
}
