export type TransportationCategory =
  | 'High-speed Rail'
  | 'Train'
  | 'City Bus'
  | 'InterCity Bus'
  | 'Plane'
  | 'Ferry / Cruise';

export interface RawSegmentRow {
  Trip: string;
  起點: string;
  終點: string;
  日期: string;
  價錢: string;
  '接駁(出發)': string;
  '接駁(到達)': string;
  交通工具: string;
  品牌: string;
  備註: string;
  'Transit Point': string;
}

export interface RawAccommodationRow {
  Trip: string;
  住宿地址: string;
  住宿城市: string;
  住宿類型: string;
  備註: string;
  '價錢/晚': string;
  原始評分: string;
  '名稱(如有)': string;
  晚數: string;
  通勤時間: string;
}

export interface AliasReference {
  cityId: string;
  airportId: string | null;
}

export interface CityReference {
  latitude: number;
  longitude: number;
  countryId: string;
}

export interface AirportReference extends CityReference {
  code: string;
  associatedCityId: string;
}

export interface ReferenceIndex {
  aliases: Map<string, AliasReference>;
  cities: Map<string, CityReference>;
  airports: Map<string, AirportReference>;
}

export interface TripRecord {
  id: string;
  title: string;
  sequence: number;
  firstDate: string;
  lastDate: string;
  segmentIds: string[];
}

export interface SegmentRecord {
  id: string;
  tripId: string;
  sequence: number;
  globalSequence: number;
  date: string;
  originCityId: string;
  destinationCityId: string;
  originCountryId: string;
  destinationCountryId: string;
  transitCityIds: string[];
  pathCityIds: string[];
  transportationSubtype: string;
  transportationCategory: TransportationCategory;
  company: string | null;
  baseCostEur: number;
  baseDistanceKm: number;
  notes: string | null;
  departureTransferId: string | null;
  arrivalTransferId: string | null;
}

export interface TransferRecord {
  id: string;
  segmentId: string;
  side: 'departure' | 'arrival';
  endpointKind: 'airport' | 'local';
  endpointCityId: string;
  airportId: string | null;
  costEur: number;
  distanceKm: number | null;
  notes: string | null;
}

export interface AccommodationRecord {
  id: string;
  tripId: string;
  sequence: number;
  cityId: string;
  countryId: string;
  type: 'Airbnb' | 'Hostel' | 'Hotel' | 'Airport';
  label: string;
  notes: string | null;
  pricePerNightEur: number;
  nights: number;
  totalCostEur: number;
  commuteMinutes: number | null;
  rating: { components: number[]; total: number };
  airportCode: string | null;
}
