import { feature } from 'topojson-client';
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldSource from 'world-atlas/countries-110m.json';

type CountryProperties = { name: string };
type WorldObjects = { countries: GeometryCollection<CountryProperties> };

const world = worldSource as unknown as Topology<WorldObjects>;

export const worldCountries = feature(
  world,
  world.objects.countries,
) as unknown as FeatureCollection<Geometry, GeoJsonProperties & CountryProperties>;
