import { optionalText, parseDurationMinutes, parseMoney, parseRating } from './parsers.ts';
import type { AccommodationRecord, RawAccommodationRow } from './types.ts';

const TYPES = new Set(['Airbnb', 'Hostel', 'Hotel', 'Airport']);

export function preprocessAccommodations(
  rows: RawAccommodationRow[],
  tripIds: Map<string, string>,
  cityIds: Map<string, { id: string; countryId: string }>,
  airportCodesByCity: Map<string, string[]> = new Map(),
): AccommodationRecord[] {
  let currentTripTitle = '';
  return rows.map((row, index) => {
    currentTripTitle = row.Trip.trim() || currentTripTitle;
    const tripId = tripIds.get(currentTripTitle);
    if (!tripId) throw new Error(`Unknown or missing Accommodation Trip: ${currentTripTitle}`);

    const sourceCity = row.住宿城市.trim();
    const canonicalCity = sourceCity === 'Krakow' ? 'Kraków' : sourceCity;
    const city = cityIds.get(canonicalCity);
    if (!city) throw new Error(`Unknown Accommodation City: ${row.住宿城市}`);

    const type = row.住宿類型.trim();
    if (!TYPES.has(type)) throw new Error(`Unknown Accommodation type: ${type}`);
    const typedType = type as AccommodationRecord['type'];
    const rating = parseRating(row.原始評分);
    const expectedComponents = typedType === 'Airport' ? 5 : 7;
    if (rating.components.length !== expectedComponents) {
      throw new Error(`${typedType} rating must have ${expectedComponents} components`);
    }
    const pricePerNightEur = parseMoney(row['價錢/晚']);
    const nights = Number(row.晚數.trim());
    if (!Number.isInteger(nights) || nights <= 0) throw new Error(`Invalid Accommodation nights: ${row.晚數}`);
    const name = optionalText(row['名稱(如有)']);
    const namedAirportCode = name?.match(/\b([A-Z]{3})\s+Airport\b/)?.[1] ?? null;
    const cityAirportCodes = airportCodesByCity.get(city.id) ?? [];
    const airportCode = typedType === 'Airport'
      ? namedAirportCode ?? (cityAirportCodes.length === 1 ? cityAirportCodes[0] ?? null : null)
      : null;

    return {
      id: numberedAccommodationId(index + 1),
      tripId,
      sequence: index + 1,
      cityId: city.id,
      countryId: city.countryId,
      type: typedType,
      label: `${typedType} in ${canonicalCity}`,
      notes: optionalText(row.備註),
      pricePerNightEur,
      nights,
      totalCostEur: Math.round(pricePerNightEur * nights * 100) / 100,
      commuteMinutes: typedType === 'Airport' ? null : parseDurationMinutes(row.通勤時間),
      rating,
      airportCode,
    };
  });
}

function numberedAccommodationId(value: number): string {
  return `accommodation-${value.toString().padStart(3, '0')}`;
}
