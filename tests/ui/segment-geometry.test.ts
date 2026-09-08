import { describe, expect, it } from 'vitest';
import source from '../../public/data/travel-data.json';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';
import { buildSegmentRoutes } from '../../src/features/map/segment-geometry.ts';
import { europeProjection } from '../../src/features/map/country-label-layout.ts';

const data = TravelDataSchema.parse(source);

describe('FR-MAP-06 route geometry', () => {
  it('hides same-country routes only in Europe, retaining them in Country Maps', () => {
    const routes = buildSegmentRoutes(data, null);
    const visible = data.segments.filter((segment) => segment.originCountryId !== segment.destinationCountryId);
    expect(routes.map(({ id }) => id)).toEqual(visible.map(({ id }) => id));
    for (const segment of data.segments.filter((segment) => segment.originCountryId === segment.destinationCountryId)) {
      expect(buildSegmentRoutes(data, segment.originCountryId).some(({ id }) => id === segment.id)).toBe(true);
    }
    for (const segment of visible) {
      const route = routes.find(({ id }) => id === segment.id)!;
      const origin = data.countries.find(({ id }) => id === segment.originCountryId)!;
      const destination = data.countries.find(({ id }) => id === segment.destinationCountryId)!;
      expect(route.points[0]).toEqual(europeProjection([origin.marker.longitude, origin.marker.latitude]));
      expect(route.points.at(-1)).toEqual(europeProjection([destination.marker.longitude, destination.marker.latitude]));
      expect(route.collapsedPath).not.toMatch(/NaN|Infinity/);
      expect(route.collapsedPath).toMatch(/[QC]/);
    }
  });

  it('uses City waypoints in travel order in Country Map and includes cross-border trips', () => {
    const routes = buildSegmentRoutes(data, 'germany');
    const cities = new Map(data.cities.map((city) => [city.id, city]));
    const expected = data.segments.filter((segment) => segment.pathCityIds.some((id) => cities.get(id)?.countryId === 'germany'));
    expect(routes.map(({ id }) => id)).toEqual(expected.map(({ id }) => id));
    for (const route of routes) {
      const segment = expected.find(({ id }) => id === route.id)!;
      expect(route.points).toEqual(segment.pathCityIds.map((id) => {
        const city = cities.get(id)!;
        return europeProjection([city.location.longitude, city.location.latitude]);
      }));
    }
    expect(buildSegmentRoutes(data, 'vatican-city')).toEqual([]);
  });

  it('keeps repeated routes distinct, deterministic, and more separated when expanded', () => {
    const routes = buildSegmentRoutes(data, null);
    expect(new Set(routes.map(({ collapsedPath }) => collapsedPath)).size).toBe(routes.length);
    const reversed = buildSegmentRoutes({ ...data, segments: [...data.segments].reverse() }, null);
    for (const route of routes) {
      expect(reversed.find(({ id }) => id === route.id)?.collapsedPath).toBe(route.collapsedPath);
    }
    const repeat = routes.find((route) => routes.filter((other) => other.groupKey === route.groupKey).length > 1)!;
    const group = routes.filter((route) => route.groupKey === repeat.groupKey);
    expect(new Set(group.map(({ expandedPath }) => expandedPath)).size).toBe(group.length);
    expect(group.some((route) => route.expandedPath !== route.collapsedPath)).toBe(true);
  });
});
