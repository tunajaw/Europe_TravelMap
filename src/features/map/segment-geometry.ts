import type { TravelData } from '../../domain/travel-data.ts';
import { europeProjection } from './country-label-layout.ts';

type Point = [number, number];
type Segment = TravelData['segments'][number];

export interface SegmentRoute {
  id: string;
  groupKey: string;
  category: Segment['transportationCategory'];
  label: string;
  points: Point[];
  collapsedPath: string;
  expandedPath: string;
}

const pointText = ([x, y]: Point) => `${x.toFixed(3)},${y.toFixed(3)}`;

function curvedPath(points: Point[], lane: number, groupSize: number, expanded: boolean, scale: number): string {
  const first = points[0]!;
  // A route with coincident reference points uses a visible loop rather than
  // a zero-length path; this is a display symbol, not a distance estimate.
  if (points.every(([x, y]) => x === first[0] && y === first[1])) {
    const radius = (24 + lane * (expanded ? Math.min(11, 100 / Math.max(1, groupSize - 1)) : .15)) * scale;
    return `M${pointText(first)} C${pointText([first[0] + radius, first[1] - radius * 2])} ${pointText([first[0] - radius, first[1] - radius * 2])} ${pointText(first)}`;
  }
  const roundTrip = first[0] === points.at(-1)![0] && first[1] === points.at(-1)![1];
  let path = `M${pointText(first)}`;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!, to = points[index]!;
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue;
    // Canonical normal puts reversed routes into the same bundle. A round
    // trip alternates sides so its outbound and return legs remain visible.
    const direction = (dx > 0 || (dx === 0 && dy > 0)) ? 1 : -1;
    const side = roundTrip && index % 2 === 0 ? -1 : 1;
    const separation = expanded ? Math.min(13, 150 / Math.max(1, groupSize - 1)) : .4;
    const offset = (Math.min(60 * scale, distance * .16) + lane * separation * scale) * direction * side;
    const control: Point = [(from[0] + to[0]) / 2 - dy / distance * offset, (from[1] + to[1]) / 2 + dx / distance * offset];
    path += ` Q${pointText(control)} ${pointText(to)}`;
  }
  return path;
}

export function buildSegmentRoutes(
  data: Pick<TravelData, 'countries' | 'cities' | 'segments'>,
  countryId: string | null,
  scale = 1,
): SegmentRoute[] {
  const cities = new Map(data.cities.map((city) => [city.id, city]));
  const countries = new Map(data.countries.map((country) => [country.id, country]));
  const segments = countryId
    ? data.segments.filter((segment) => segment.pathCityIds.some((id) => cities.get(id)?.countryId === countryId))
    : data.segments.filter((segment) => segment.originCountryId !== segment.destinationCountryId);
  const prepared = segments.map((segment) => {
    const ids = countryId ? segment.pathCityIds : segment.pathCityIds.map((id) => cities.get(id)!.countryId);
    const points: Point[] = ids.map((id) => {
      const coordinate = countryId ? cities.get(id)!.location : countries.get(id)!.marker;
      return europeProjection([coordinate.longitude, coordinate.latitude])!;
    });
    return { segment, points, groupKey: [ids[0]!, ids.at(-1)!].sort().join('|') };
  });
  const groups = new Map<string, string[]>();
  for (const { groupKey, segment } of [...prepared].sort((a, b) => a.segment.globalSequence - b.segment.globalSequence || a.segment.id.localeCompare(b.segment.id))) {
    const group = groups.get(groupKey) ?? [];
    group.push(segment.id);
    groups.set(groupKey, group);
  }
  return prepared.map(({ segment, points, groupKey }) => {
    const lane = groups.get(groupKey)!.indexOf(segment.id);
    return {
      id: segment.id, groupKey, category: segment.transportationCategory, points,
      label: `${cities.get(segment.originCityId)!.name} to ${cities.get(segment.destinationCityId)!.name}, ${segment.date}, ${segment.transportationCategory}`,
      collapsedPath: curvedPath(points, lane, groups.get(groupKey)!.length, false, scale),
      expandedPath: curvedPath(points, lane, groups.get(groupKey)!.length, true, scale),
    };
  });
}
