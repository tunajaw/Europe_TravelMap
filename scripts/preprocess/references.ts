import { join } from 'node:path';
import { readCsv } from './csv.ts';
import { slugify } from './slug.ts';
import type { ReferenceIndex } from './types.ts';
import type { TravelData } from '../../src/domain/travel-data.ts';

type CountryRow = {
  country: string; country_slug: string; capital_city: string; is_microstate: string;
  include_in_mvp: string; candidate_latitude: string; candidate_longitude: string;
  inclusion_status: string; geocode_review_status: string;
};
type CityGeoRow = {
  canonical_city: string; country: string; reference_point: string;
  candidate_latitude: string; candidate_longitude: string; review_status: string;
};
type CityStationRow = {
  canonical_city: string; proposed_reference_point: string; reference_point_type: string; review_status: string;
};
type AirportRow = {
  airport_code: string; airport_name: string; country: string; associated_city: string;
  candidate_latitude: string; candidate_longitude: string; review_status: string;
};
type AliasRow = {
  raw_location: string; airport_code: string; canonical_city: string; review_status: string;
};
type LocalTransferRow = {
  transfer_id: string; segment_id: string; side: string;
  start_name: string; start_latitude: string; start_longitude: string;
  end_name: string; end_latitude: string; end_longitude: string;
  review_status: string;
};

export interface LoadedReferences {
  index: ReferenceIndex;
  countries: TravelData['countries'];
  cities: TravelData['cities'];
  airports: TravelData['airports'];
  countryIdByName: Map<string, string>;
  cityIdByName: Map<string, { id: string; countryId: string }>;
}

function requireApproved(status: string, label: string): void {
  if (status !== 'approved') throw new Error(`Unapproved reference: ${label}`);
}

export async function loadReferences(root: string): Promise<LoadedReferences> {
  const parsed = join(root, 'data', 'parsed');
  const [countryRows, cityRows, stationRows, airportRows, aliasRows, localTransferRows] = await Promise.all([
    readCsv<CountryRow>(join(parsed, 'country_reference.csv')),
    readCsv<CityGeoRow>(join(parsed, 'city_reference_geocoding.csv')),
    readCsv<CityStationRow>(join(parsed, 'city_main_station.csv')),
    readCsv<AirportRow>(join(parsed, 'airport_reference.csv')),
    readCsv<AliasRow>(join(parsed, 'location_alias.csv')),
    readCsv<LocalTransferRow>(join(parsed, 'local_transfer_reference.csv')),
  ]);

  const countryIdByName = new Map<string, string>();
  const countries = countryRows.filter((row) => row.include_in_mvp === 'true').map((row) => {
    requireApproved(row.inclusion_status, `Country inclusion ${row.country}`);
    requireApproved(row.geocode_review_status, `Country coordinates ${row.country}`);
    countryIdByName.set(row.country, row.country_slug);
    return {
      id: row.country_slug,
      name: row.country,
      slug: row.country_slug,
      capitalCity: row.capital_city,
      isMicrostate: row.is_microstate === 'true',
      marker: { latitude: Number(row.candidate_latitude), longitude: Number(row.candidate_longitude) },
      photoIds: [] as string[],
    };
  });

  const stationByCity = new Map(stationRows.map((row) => [row.canonical_city, row]));
  const cityIdByName = new Map<string, { id: string; countryId: string }>();
  const cities = cityRows.map((row) => {
    requireApproved(row.review_status, `City coordinates ${row.canonical_city}`);
    const station = stationByCity.get(row.canonical_city);
    if (!station) throw new Error(`Missing City reference point: ${row.canonical_city}`);
    requireApproved(station.review_status, `City reference point ${row.canonical_city}`);
    if (station.proposed_reference_point !== row.reference_point) {
      throw new Error(`City reference point mismatch: ${row.canonical_city}`);
    }
    const countryId = countryIdByName.get(row.country);
    if (!countryId) throw new Error(`Unknown Country for City ${row.canonical_city}: ${row.country}`);
    const id = `city-${slugify(row.canonical_city)}`;
    cityIdByName.set(row.canonical_city, { id, countryId });
    return {
      id,
      name: row.canonical_city,
      countryId,
      referencePointName: row.reference_point,
      referencePointType: station.reference_point_type,
      location: { latitude: Number(row.candidate_latitude), longitude: Number(row.candidate_longitude) },
    };
  });

  const airports = airportRows.map((row) => {
    requireApproved(row.review_status, `Airport ${row.airport_code}`);
    const countryId = countryIdByName.get(row.country);
    const city = cityIdByName.get(row.associated_city);
    if (!countryId || !city) throw new Error(`Unknown Airport relationship: ${row.airport_code}`);
    return {
      id: `airport-${row.airport_code.toLowerCase()}`,
      code: row.airport_code,
      name: row.airport_name,
      countryId,
      associatedCityId: city.id,
      location: { latitude: Number(row.candidate_latitude), longitude: Number(row.candidate_longitude) },
    };
  });

  const aliases = new Map<string, { cityId: string; airportId: string | null }>();
  for (const row of aliasRows) {
    requireApproved(row.review_status, `Location alias ${row.raw_location}`);
    const city = cityIdByName.get(row.canonical_city);
    if (!city) throw new Error(`Unknown City for alias ${row.raw_location}: ${row.canonical_city}`);
    aliases.set(row.raw_location, {
      cityId: city.id,
      airportId: row.airport_code ? `airport-${row.airport_code.toLowerCase()}` : null,
    });
  }

  const localTransfers = new Map(localTransferRows.map((row) => {
    requireApproved(row.review_status, `Local Transfer ${row.transfer_id}`);
    if (row.transfer_id !== `transfer-${row.segment_id.slice('segment-'.length)}-${row.side}`) {
      throw new Error(`Local Transfer identity mismatch: ${row.transfer_id}`);
    }
    if (row.side !== 'departure' && row.side !== 'arrival') {
      throw new Error(`Invalid Local Transfer side: ${row.transfer_id}`);
    }
    return [row.transfer_id, {
      start: {
        name: row.start_name,
        latitude: Number(row.start_latitude),
        longitude: Number(row.start_longitude),
      },
      end: {
        name: row.end_name,
        latitude: Number(row.end_latitude),
        longitude: Number(row.end_longitude),
      },
    }];
  }));
  if (localTransfers.size !== localTransferRows.length) {
    throw new Error('Duplicate Local Transfer reference ID');
  }

  return {
    countries,
    cities,
    airports,
    countryIdByName,
    cityIdByName,
    index: {
      aliases,
      cities: new Map(cities.map((city) => [city.id, {
        latitude: city.location.latitude,
        longitude: city.location.longitude,
        countryId: city.countryId,
      }])),
      airports: new Map(airports.map((airport) => [airport.id, {
        code: airport.code,
        associatedCityId: airport.associatedCityId,
        countryId: airport.countryId,
        latitude: airport.location.latitude,
        longitude: airport.location.longitude,
      }])),
      localTransfers,
    },
  };
}
