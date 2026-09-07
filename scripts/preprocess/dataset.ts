import { access } from 'node:fs/promises';
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

export async function buildDataset(root: string): Promise<TravelData> {
  const references = await loadReferences(root);
  const segmentRows = await readNotionExportCsv<RawSegmentRow>(join(root, 'data', 'raw', 'segment-raw.csv'));
  const accommodationRows = await readCsv<RawAccommodationRow>(
    join(root, 'data', 'private', 'accommodation-raw.csv'),
  );
  const photoRows = await readCsv<PhotoRow>(join(root, 'data', 'parsed', 'photo_manifest.csv'));
  const { trips, segments, transfers } = preprocessSegments(segmentRows, references.index);
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

  const data = TravelDataSchema.parse({
    schemaVersion: '1.0.0',
    travelPeriod: { start: '2025-09-30', end: '2026-04-30' },
    countries,
    cities: references.cities,
    airports: references.airports,
    trips,
    segments,
    transfers,
    accommodations,
    photos,
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
