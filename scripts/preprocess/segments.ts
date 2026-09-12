import { haversineKm, roundedKm } from './geo.ts';
import { optionalText, parseDate, parseMoney, splitSegmentNotes } from './parsers.ts';
import type {
  RawSegmentRow,
  ReferenceIndex,
  SegmentRecord,
  TransportationCategory,
  TransferRecord,
  TripRecord,
} from './types.ts';

const CATEGORIES: Record<string, TransportationCategory> = {
  高鐵: 'High-speed Rail',
  火車: 'Train',
  公車: 'City Bus',
  客運: 'InterCity Bus',
  飛機: 'Plane',
  郵輪: 'Ferry / Cruise',
};

function numberedId(prefix: string, value: number): string {
  return `${prefix}-${value.toString().padStart(3, '0')}`;
}

export function preprocessSegments(
  rows: RawSegmentRow[],
  references: ReferenceIndex,
): { trips: TripRecord[]; segments: SegmentRecord[]; transfers: TransferRecord[] } {
  const trips: TripRecord[] = [];
  const segments: SegmentRecord[] = [];
  const transfers: TransferRecord[] = [];
  let currentTrip: TripRecord | undefined;

  const aliasFor = (raw: string) => {
    const alias = references.aliases.get(raw.trim());
    if (!alias) throw new Error(`Unknown location alias: ${raw}`);
    return alias;
  };
  const cityFor = (id: string) => {
    const city = references.cities.get(id);
    if (!city) throw new Error(`Unknown City reference: ${id}`);
    return city;
  };

  rows.forEach((row, rowIndex) => {
    const title = row.Trip.trim();
    if (title) {
      currentTrip = {
        id: numberedId('trip', trips.length + 1), title, sequence: trips.length + 1,
        firstDate: '', lastDate: '', segmentIds: [],
      };
      trips.push(currentTrip);
    }
    if (!currentTrip) throw new Error(`Missing Trip title before Segment row ${rowIndex + 1}`);

    const segmentId = numberedId('segment', rowIndex + 1);
    const date = parseDate(row.日期);
    const origin = aliasFor(row.起點);
    const destination = aliasFor(row.終點);
    const transitCityIds = row['Transit Point'].trim()
      ? row['Transit Point'].split(',').map((label) => label.trim()).filter(Boolean).map((label) => aliasFor(label).cityId)
      : [];
    const pathCityIds = [origin.cityId, ...transitCityIds, destination.cityId];
    const originCity = cityFor(origin.cityId);
    const destinationCity = cityFor(destination.cityId);
    const notes = splitSegmentNotes(row.備註);
    const category = CATEGORIES[row.交通工具.trim()];
    if (!category) throw new Error(`Unknown transportation subtype: ${row.交通工具}`);

    const distance = transitCityIds.length > 0
      ? pathCityIds.slice(1).reduce((total, cityId, index) => {
          const priorId = pathCityIds[index];
          if (!priorId) throw new Error(`Invalid Segment path: ${segmentId}`);
          return total + haversineKm(cityFor(priorId), cityFor(cityId));
        }, 0)
      : haversineKm(originCity, destinationCity);

    const createTransfer = (
      side: 'departure' | 'arrival',
      costSource: string,
      transferNotes: string | null,
      endpoint: typeof origin,
    ): string | null => {
      const costEur = parseMoney(costSource);
      if (costEur === 0 && transferNotes === null) return null;
      const airport = endpoint.airportId ? references.airports.get(endpoint.airportId) : undefined;
      if (endpoint.airportId && !airport) throw new Error(`Unknown Airport reference: ${endpoint.airportId}`);
      const transferId = `transfer-${segmentId.slice('segment-'.length)}-${side}`;
      const localRoute = airport ? null : references.localTransfers.get(transferId);
      if (!airport && !localRoute) throw new Error(`Missing Local Transfer reference: ${transferId}`);
      transfers.push({
        id: transferId,
        segmentId,
        side,
        endpointKind: airport ? 'airport' : 'local',
        endpointCityId: endpoint.cityId,
        airportId: endpoint.airportId,
        expenseInclusion: airport ? 'airport-filter' : 'always',
        costEur,
        distanceKm: roundedKm(airport
          ? haversineKm(cityFor(airport.associatedCityId), airport)
          : haversineKm(localRoute!.start, localRoute!.end)),
        localRoute: localRoute ?? null,
        notes: transferNotes,
      });
      return transferId;
    };

    const departureTransferId = createTransfer('departure', row['接駁(出發)'], notes.departure, origin);
    const arrivalTransferId = createTransfer('arrival', row['接駁(到達)'], notes.arrival, destination);
    const segment: SegmentRecord = {
      id: segmentId,
      tripId: currentTrip.id,
      sequence: currentTrip.segmentIds.length + 1,
      globalSequence: rowIndex + 1,
      date,
      originCityId: origin.cityId,
      destinationCityId: destination.cityId,
      originCountryId: originCity.countryId,
      destinationCountryId: destinationCity.countryId,
      transitCityIds,
      pathCityIds,
      transportationSubtype: row.交通工具.trim(),
      transportationCategory: category,
      company: optionalText(row.品牌),
      baseCostEur: parseMoney(row.價錢),
      baseDistanceKm: roundedKm(distance),
      notes: notes.segment,
      departureTransferId,
      arrivalTransferId,
    };
    segments.push(segment);
    currentTrip.segmentIds.push(segmentId);
    currentTrip.firstDate ||= date;
    currentTrip.lastDate = date;
  });

  return { trips, segments, transfers };
}
