import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { preprocessAccommodations } from './accommodations.ts';
import { readCsv, readNotionExportCsv } from './csv.ts';
import { loadReferences } from './references.ts';
import { preprocessSegments } from './segments.ts';
import type { RawAccommodationRow, RawSegmentRow } from './types.ts';
import { TravelDataSchema, assertReferentialIntegrity, type TravelData } from '../../src/domain/travel-data.ts';

type PhotoRow = {
  photo_id: string; country: string; file_path: string; display_order: string;
  candidate_city: string; alt_text_draft: string; rights_status: string; metadata_status: string;
};

type PoiReferenceRow = {
  poi_id: string; city_id: string; name: string; category: 'Attraction' | 'Unclassified'; subcategory: string;
  latitude: number; longitude: number; review_status: string;
  localized_name?: string | null; original_name?: string;
};

type CityContextReferenceRow = {
  city_id: string; kind: 'administrative_boundary' | 'local_extent';
  source: 'OpenStreetMap' | 'Reviewed city reference'; source_osm_id: string | null; source_label: string;
  boundary: { type: 'Polygon'; coordinates: [number, number][][] }
    | { type: 'MultiPolygon'; coordinates: [number, number][][][] };
};

export async function buildDataset(root: string): Promise<TravelData> {
  const references = await loadReferences(root);
  const segmentRows = await readNotionExportCsv<RawSegmentRow>(join(root, 'data', 'raw', 'segment-raw.csv'));
  const accommodationRows = await readCsv<RawAccommodationRow>(
    join(root, 'data', 'private', 'accommodation-raw.csv'),
  );
  const photoRows = await readCsv<PhotoRow>(join(root, 'data', 'parsed', 'photo_manifest.csv'));
  const poiRows = JSON.parse(await readFile(
    join(root, 'data', 'parsed', 'poi_reference.json'), 'utf8',
  )) as PoiReferenceRow[];
  const cityContextRows = JSON.parse(await readFile(
    join(root, 'data', 'parsed', 'city_map_context.json'), 'utf8',
  )) as CityContextReferenceRow[];
  const { trips, segments, transfers } = preprocessSegments(segmentRows, references.index);
  const localTransferIds = new Set(
    transfers.filter(({ endpointKind }) => endpointKind === 'local').map(({ id }) => id),
  );
  if (localTransferIds.size !== references.index.localTransfers.size
    || [...references.index.localTransfers.keys()].some((id) => !localTransferIds.has(id))) {
    throw new Error('Local Transfer reference coverage does not match the source Transfers');
  }
  const tripIds = new Map(trips.map((trip) => [trip.title, trip.id]));
  const airportCodesByCity = new Map<string, string[]>();
  for (const airport of references.airports) {
    const codes = airportCodesByCity.get(airport.associatedCityId) ?? [];
    codes.push(airport.code);
    airportCodesByCity.set(airport.associatedCityId, codes);
  }
  const accommodations = preprocessAccommodations(
    accommodationRows,
    tripIds,
    references.cityIdByName,
    airportCodesByCity,
    references.accommodationStations,
  );

  const photos = photoRows.map((row) => {
    if (row.rights_status !== 'owner_provided') throw new Error(`Unconfirmed photo rights: ${row.photo_id}`);
    if (row.metadata_status !== 'stripped') throw new Error(`Photo metadata not stripped: ${row.photo_id}`);
    const countryId = references.countryIdByName.get(row.country);
    if (!countryId) throw new Error(`Unknown Photo Country: ${row.country}`);
    const candidateCityId = row.candidate_city
      ? references.cityIdByName.get(row.candidate_city)?.id
      : null;
    if (row.candidate_city && !candidateCityId) throw new Error(`Unknown Photo City: ${row.candidate_city}`);
    return {
      id: row.photo_id,
      countryId,
      path: row.file_path.replace(/^\/+/, ''),
      displayOrder: Number(row.display_order),
      candidateCityId,
      altText: row.alt_text_draft,
    };
  });
  for (const photo of photos) {
    const fullPath = join(root, 'public', ...photo.path.split('/'));
    await access(fullPath);
  }

  const countries = references.countries.map((country) => ({
    ...country,
    photoIds: photos
      .filter((photo) => photo.countryId === country.id)
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((photo) => photo.id),
  }));

  const pois = poiRows.map((row) => {
    if (row.review_status !== 'provisional_owner_assumption'
      || !['Attraction', 'Unclassified'].includes(row.category)) {
      throw new Error(`POI is not approved for the City Map prototype: ${row.poi_id}`);
    }
    if (!references.cities.some((city) => city.id === row.city_id)) throw new Error(`Unknown POI City: ${row.city_id}`);
    return {
      id: row.poi_id,
      cityId: row.city_id,
      name: row.name,
      localizedName: row.localized_name ?? null,
      category: row.category,
      subcategory: row.subcategory,
      location: { latitude: row.latitude, longitude: row.longitude },
      imagePath: null,
    };
  });

  const cityContexts = cityContextRows.map((row) => {
    if ((row.kind === 'administrative_boundary') !== (row.source === 'OpenStreetMap')) {
      throw new Error(`City context kind/source mismatch: ${row.city_id}`);
    }
    if (!references.cities.some((city) => city.id === row.city_id)) throw new Error(`Unknown City context City: ${row.city_id}`);
    return { cityId: row.city_id, kind: row.kind, source: row.source, boundary: row.boundary };
  });
  const allCityIds = new Set(references.cities.map(({ id }) => id));
  if (cityContexts.length !== allCityIds.size
    || cityContexts.some(({ cityId }) => !allCityIds.has(cityId))) {
    throw new Error('City context references must exactly cover all Travel Map Cities');
  }

  const data = TravelDataSchema.parse({
    schemaVersion: '1.5.0',
    travelPeriod: { start: '2025-09-30', end: '2026-04-30' },
    countries,
    cities: references.cities,
    airports: references.airports,
    trips,
    segments,
    transfers,
    accommodations,
    photos,
    pois,
    cityContexts,
  });
  assertReferentialIntegrity(data);
  await assertPrivateFieldsExcluded(data, accommodationRows);
  return data;
}

async function assertPrivateFieldsExcluded(
  data: TravelData,
  sourceRows: RawAccommodationRow[],
): Promise<void> {
  const serialized = JSON.stringify(data);
  for (const row of sourceRows) {
    for (const privateValue of [row.住宿地址.trim(), row['名稱(如有)'].trim()]) {
      if (privateValue && serialized.includes(privateValue)) {
        throw new Error('Public output contains a private Accommodation field');
      }
    }
  }
  // Keep this check explicit so future source fields cannot leak through object spreading.
  if (serialized.includes('住宿地址') || serialized.includes('名稱(如有)')) {
    throw new Error('Public output contains a private Accommodation column name');
  }
}
