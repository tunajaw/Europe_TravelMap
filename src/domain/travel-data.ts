import { z } from 'zod';

const id = z.string().min(1);
const coordinate = z.object({ latitude: z.number().gte(-90).lte(90), longitude: z.number().gte(-180).lte(180) }).strict();
const transferPoint = coordinate.extend({ name: z.string().min(1) }).strict();
const localTransferRoute = z.object({ start: transferPoint, end: transferPoint }).strict();

export const TravelDataSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  travelPeriod: z.object({ start: z.iso.date(), end: z.iso.date() }).strict(),
  countries: z.array(z.object({
    id, name: z.string().min(1), slug: z.string().min(1), boundaryId: z.string().regex(/^\d{3}$/), capitalCity: z.string().min(1),
    isMicrostate: z.boolean(), marker: coordinate, photoIds: z.array(id),
  }).strict()),
  cities: z.array(z.object({
    id, name: z.string().min(1), countryId: id, referencePointName: z.string().min(1),
    referencePointType: z.string().min(1), location: coordinate,
  }).strict()),
  airports: z.array(z.object({
    id, code: z.string().regex(/^[A-Z]{3}$/), name: z.string().min(1), countryId: id,
    associatedCityId: id, location: coordinate,
  }).strict()),
  trips: z.array(z.object({
    id, title: z.string().min(1), sequence: z.number().int().positive(), firstDate: z.iso.date(),
    lastDate: z.iso.date(), segmentIds: z.array(id).min(1),
  }).strict()),
  segments: z.array(z.object({
    id, tripId: id, sequence: z.number().int().positive(), globalSequence: z.number().int().positive(),
    date: z.iso.date(), originCityId: id, destinationCityId: id, originCountryId: id,
    destinationCountryId: id, transitCityIds: z.array(id), pathCityIds: z.array(id).min(2),
    transportationSubtype: z.string().min(1),
    transportationCategory: z.enum(['High-speed Rail', 'Train', 'City Bus', 'InterCity Bus', 'Plane', 'Ferry / Cruise']),
    company: z.string().nullable(), baseCostEur: z.number().nonnegative(), baseDistanceKm: z.number().nonnegative(),
    notes: z.string().nullable(), departureTransferId: id.nullable(), arrivalTransferId: id.nullable(),
  }).strict()),
  transfers: z.array(z.object({
    id, segmentId: id, side: z.enum(['departure', 'arrival']), endpointKind: z.enum(['airport', 'local']),
    endpointCityId: id, airportId: id.nullable(), expenseInclusion: z.enum(['always', 'airport-filter']),
    costEur: z.number().nonnegative(), distanceKm: z.number().nonnegative(),
    localRoute: localTransferRoute.nullable(), notes: z.string().nullable(),
  }).strict()),
  accommodations: z.array(z.object({
    id, tripId: id, sequence: z.number().int().positive(), cityId: id, countryId: id,
    type: z.enum(['Airbnb', 'Hostel', 'Hotel', 'Airport']), label: z.string().min(1),
    notes: z.string().nullable(), pricePerNightEur: z.number().nonnegative(), nights: z.number().int().positive(),
    totalCostEur: z.number().nonnegative(), commuteMinutes: z.number().int().nonnegative().nullable(),
    rating: z.object({ components: z.array(z.number()), total: z.number() }).strict(),
    airportCode: z.string().regex(/^[A-Z]{3}$/).nullable(),
  }).strict()),
  photos: z.array(z.object({
    id, countryId: id, path: z.string().min(1).refine((value) => !value.startsWith('/'), 'Photo path must be base-relative'),
    displayOrder: z.number().int().positive(), candidateCityId: id.nullable(), altText: z.string().min(1),
  }).strict()),
}).strict();

export type TravelData = z.infer<typeof TravelDataSchema>;

export function assertReferentialIntegrity(data: TravelData): void {
  const uniqueIds = (label: string, values: string[]): Set<string> => {
    const set = new Set(values);
    if (set.size !== values.length) throw new Error(`Duplicate ${label} ID`);
    return set;
  };
  const countries = uniqueIds('Country', data.countries.map(({ id }) => id));
  const cities = uniqueIds('City', data.cities.map(({ id }) => id));
  const airports = uniqueIds('Airport', data.airports.map(({ id }) => id));
  const trips = uniqueIds('Trip', data.trips.map(({ id }) => id));
  const segments = uniqueIds('Segment', data.segments.map(({ id }) => id));
  const transfers = uniqueIds('Transfer', data.transfers.map(({ id }) => id));
  uniqueIds('Accommodation', data.accommodations.map(({ id }) => id));
  const photos = uniqueIds('Photo', data.photos.map(({ id }) => id));

  const requireId = (set: Set<string>, value: string, relationship: string): void => {
    if (!set.has(value)) throw new Error(`Broken ${relationship}: ${value}`);
  };
  for (const city of data.cities) requireId(countries, city.countryId, 'City Country');
  for (const airport of data.airports) {
    requireId(countries, airport.countryId, 'Airport Country');
    requireId(cities, airport.associatedCityId, 'Airport City');
  }
  for (const trip of data.trips) trip.segmentIds.forEach((value) => requireId(segments, value, 'Trip Segment'));
  for (const segment of data.segments) {
    requireId(trips, segment.tripId, 'Segment Trip');
    [segment.originCityId, segment.destinationCityId, ...segment.transitCityIds, ...segment.pathCityIds]
      .forEach((value) => requireId(cities, value, 'Segment City'));
    requireId(countries, segment.originCountryId, 'Segment origin Country');
    requireId(countries, segment.destinationCountryId, 'Segment destination Country');
    if (segment.departureTransferId) requireId(transfers, segment.departureTransferId, 'Segment departure Transfer');
    if (segment.arrivalTransferId) requireId(transfers, segment.arrivalTransferId, 'Segment arrival Transfer');
    if (segment.pathCityIds[0] !== segment.originCityId
      || segment.pathCityIds.at(-1) !== segment.destinationCityId) {
      throw new Error(`Segment path endpoints do not match: ${segment.id}`);
    }
    if (segment.date < data.travelPeriod.start || segment.date > data.travelPeriod.end) {
      throw new Error(`Segment date is outside the travel period: ${segment.id}`);
    }
  }
  for (const transfer of data.transfers) {
    requireId(segments, transfer.segmentId, 'Transfer Segment');
    requireId(cities, transfer.endpointCityId, 'Transfer City');
    if (transfer.airportId) requireId(airports, transfer.airportId, 'Transfer Airport');
    if (transfer.endpointKind === 'airport'
      && (!transfer.airportId || transfer.localRoute !== null || transfer.expenseInclusion !== 'airport-filter')) {
      throw new Error(`Airport Transfer lacks Airport geometry: ${transfer.id}`);
    }
    if (transfer.endpointKind === 'local'
      && (transfer.airportId !== null || transfer.localRoute === null || transfer.expenseInclusion !== 'always')) {
      throw new Error(`Local Transfer lacks reviewed route geometry: ${transfer.id}`);
    }
    const segment = data.segments.find(({ id }) => id === transfer.segmentId);
    const expectedCity = transfer.side === 'departure' ? segment?.originCityId : segment?.destinationCityId;
    if (transfer.endpointCityId !== expectedCity) throw new Error(`Transfer endpoint mismatch: ${transfer.id}`);
  }
  for (const accommodation of data.accommodations) {
    requireId(trips, accommodation.tripId, 'Accommodation Trip');
    requireId(cities, accommodation.cityId, 'Accommodation City');
    requireId(countries, accommodation.countryId, 'Accommodation Country');
  }
  for (const photo of data.photos) {
    requireId(countries, photo.countryId, 'Photo Country');
    if (photo.candidateCityId) requireId(cities, photo.candidateCityId, 'Photo candidate City');
  }
  for (const country of data.countries) {
    country.photoIds.forEach((value) => requireId(photos, value, 'Country Photo'));
    const countryPhotos = data.photos.filter(({ countryId }) => countryId === country.id);
    if (countryPhotos.length !== 3 || country.photoIds.length !== 3) {
      throw new Error(`Country must have exactly three Photos: ${country.id}`);
    }
    const orders = countryPhotos.map(({ displayOrder }) => displayOrder).sort((left, right) => left - right);
    if (orders.join(',') !== '1,2,3') throw new Error(`Country Photo order must be 1,2,3: ${country.id}`);
  }
  for (const trip of data.trips) {
    const tripSegments = trip.segmentIds.map((segmentId) => data.segments.find(({ id }) => id === segmentId));
    if (tripSegments.some((segment) => !segment || segment.tripId !== trip.id)) {
      throw new Error(`Trip contains a Segment owned by another Trip: ${trip.id}`);
    }
    tripSegments.forEach((segment, index) => {
      if (segment?.sequence !== index + 1) throw new Error(`Trip Segment sequence mismatch: ${trip.id}`);
    });
    if (tripSegments[0]?.date !== trip.firstDate || tripSegments.at(-1)?.date !== trip.lastDate) {
      throw new Error(`Trip date boundary mismatch: ${trip.id}`);
    }
  }
}
