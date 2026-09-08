import { geoMercator, type GeoProjection } from 'd3-geo';
import type { TravelData } from '../../domain/travel-data.ts';

type Country = Pick<TravelData['countries'][number], 'id' | 'name' | 'marker'>;

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 700;

const LABEL_HEIGHT = 16;
const LABEL_PADDING = 4;
const MARKER_CLEARANCE = 9;
const RING_OFFSETS = [0, 10, 22, 38, 58, 82, 110, 142, 178, 218, 262] as const;

export interface LabelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CountryLabelPlacement {
  countryId: string;
  markerX: number;
  markerY: number;
  labelX: number;
  labelY: number;
  box: LabelBox;
  showLeader: boolean;
}

export const europeProjection = geoMercator()
  .center([12, 53])
  .scale(650)
  .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);

export function boxesOverlap(left: LabelBox, right: LabelBox): boolean {
  return !(
    left.right <= right.left ||
    left.left >= right.right ||
    left.bottom <= right.top ||
    left.top >= right.bottom
  );
}

function estimateLabelWidth(label: string): number {
  return Math.max(42, label.length * 7.2 + LABEL_PADDING * 2);
}

function createBox(centerX: number, centerY: number, width: number): LabelBox {
  return {
    left: centerX - width / 2,
    top: centerY - LABEL_HEIGHT / 2,
    right: centerX + width / 2,
    bottom: centerY + LABEL_HEIGHT / 2,
  };
}

function isInsideMap(box: LabelBox): boolean {
  return box.left >= 0 && box.top >= 0 && box.right <= MAP_WIDTH && box.bottom <= MAP_HEIGHT;
}

function expandBox(box: LabelBox): LabelBox {
  return {
    left: box.left - LABEL_PADDING,
    top: box.top - LABEL_PADDING,
    right: box.right + LABEL_PADDING,
    bottom: box.bottom + LABEL_PADDING,
  };
}

function nearestNeighbourDistance(
  point: readonly [number, number],
  points: ReadonlyArray<readonly [number, number]>,
): number {
  return Math.min(
    ...points
      .filter((candidate) => candidate !== point)
      .map((candidate) => Math.hypot(point[0] - candidate[0], point[1] - candidate[1])),
  );
}

export function layoutCountryLabels(
  countries: readonly Country[],
  projection: GeoProjection,
): CountryLabelPlacement[] {
  const projected = countries.flatMap((country) => {
    const point = projection([country.marker.longitude, country.marker.latitude]);
    return point ? [{ country, point: point as [number, number] }] : [];
  });
  const points = projected.map(({ point }) => point);
  const placementByCountry = new Map<string, CountryLabelPlacement>();
  const occupiedBoxes: LabelBox[] = [];

  const placementOrder = [...projected].sort((left, right) => {
    const densityDifference =
      nearestNeighbourDistance(left.point, points) - nearestNeighbourDistance(right.point, points);
    return densityDifference || left.country.id.localeCompare(right.country.id);
  });

  for (const { country, point: [markerX, markerY] } of placementOrder) {
    const labelWidth = estimateLabelWidth(country.name);
    let selected: CountryLabelPlacement | undefined;

    for (const ringOffset of RING_OFFSETS) {
      const horizontal = labelWidth / 2 + MARKER_CLEARANCE + ringOffset;
      const vertical = LABEL_HEIGHT / 2 + MARKER_CLEARANCE + ringOffset;
      const candidates: ReadonlyArray<readonly [number, number]> = [
        [markerX, markerY - vertical],
        [markerX + horizontal, markerY],
        [markerX, markerY + vertical],
        [markerX - horizontal, markerY],
        [markerX + horizontal, markerY - vertical],
        [markerX + horizontal, markerY + vertical],
        [markerX - horizontal, markerY + vertical],
        [markerX - horizontal, markerY - vertical],
      ];

      for (const [labelX, labelY] of candidates) {
        const box = createBox(labelX, labelY, labelWidth);
        if (!isInsideMap(box)) continue;
        if (occupiedBoxes.some((occupied) => boxesOverlap(expandBox(box), occupied))) continue;

        selected = {
          countryId: country.id,
          markerX,
          markerY,
          labelX,
          labelY,
          box,
          showLeader: Math.hypot(labelX - markerX, labelY - markerY) > 30,
        };
        break;
      }

      if (selected) break;
    }

    if (!selected) {
      throw new Error(`Unable to place the country label for ${country.name}.`);
    }

    occupiedBoxes.push(expandBox(selected.box));
    placementByCountry.set(country.id, selected);
  }

  return countries.flatMap((country) => {
    const placement = placementByCountry.get(country.id);
    return placement ? [placement] : [];
  });
}
