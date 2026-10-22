import { createHash } from "node:crypto";

import { haversineKm } from "../preprocess/geo.ts";

export const REVIEW_START_DATE = "2025-09-30";
export const REVIEW_END_DATE = "2026-03-31";

export type Coordinate = { latitude: number; longitude: number };

export type TravelCity = {
  id: string;
  name: string;
  countryId: string;
  location: Coordinate;
};

export type CityCandidate = {
  city: TravelCity;
  distanceKm: number;
  confidence: "high" | "medium" | "low" | "unresolved";
  secondDistanceKm: number | null;
};

export type PoiCategory =
  | "Attraction"
  | "Restaurant"
  | "Station"
  | "Takeaway"
  | "Shopping Mall"
  | "Supermarket"
  | "Convenience Store"
  | "Shop"
  | "Other";

export type OsmFeature = {
  osmId: string;
  osmUrl: string;
  name: string;
  category: PoiCategory;
  subcategory: string;
  latitude: number;
  longitude: number;
  tags: Record<string, string>;
};

export type RankedOsmCandidate = OsmFeature & { distanceMeters: number };

export type PoiNameMatch = {
  score: number;
  method: "exact" | "alias_exact" | "phrase_containment" | "token_containment" | "token_similarity";
  matchedAlias: string;
};

export type MapActivityAction = "search" | "view" | "directions";

export type MapActivity = {
  activityId: string;
  action: MapActivityAction;
  title: string;
  url: string;
  occurredAt: string;
  googlePlaceIds: string[];
};

export type MapActivityEvidence = {
  strength: "high" | "medium" | "low" | "none";
  relevantActivityCount: number;
  exactPlaceIdMatchCount: number;
  candidateNameMatchCount: number;
  preVisitSearchMatchCount: number;
  preVisitNamedMatchCount: number;
  nearestActivityGapHours: number | null;
  matchedName: string;
  matchedCandidate: number | null;
  preVisitSearchCandidate: number | null;
  preVisitNamedCandidate: number | null;
  activityTypes: MapActivityAction[];
  candidateMatchCounts: number[];
  candidatePreVisitSearchMatchCounts: number[];
  candidatePreVisitNamedMatchCounts: number[];
};

const COUNTRY_TIMEZONES: Record<string, string> = {
  andorra: "Europe/Andorra",
  austria: "Europe/Vienna",
  belgium: "Europe/Brussels",
  czechia: "Europe/Prague",
  france: "Europe/Paris",
  germany: "Europe/Berlin",
  hungary: "Europe/Budapest",
  ireland: "Europe/Dublin",
  italy: "Europe/Rome",
  lithuania: "Europe/Vilnius",
  monaco: "Europe/Monaco",
  netherlands: "Europe/Amsterdam",
  "north-macedonia": "Europe/Skopje",
  norway: "Europe/Oslo",
  poland: "Europe/Warsaw",
  romania: "Europe/Bucharest",
  spain: "Europe/Madrid",
  turkey: "Europe/Istanbul",
  "united-kingdom": "Europe/London",
  "vatican-city": "Europe/Rome",
};

export function parseLatLng(value: string): Coordinate {
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?)°?\s*,\s*(-?\d+(?:\.\d+)?)°?\s*$/);
  if (!match) throw new Error(`Invalid Timeline coordinate: ${value}`);
  return { latitude: Number(match[1]), longitude: Number(match[2]) };
}

export function stableId(prefix: string, ...parts: Array<string | number>): string {
  const digest = createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 14);
  return `${prefix}-${digest}`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function plainText(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function parseTakeoutCstTimestamp(value: string): Date {
  const match = value.trim().match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(凌晨|上午|中午|下午|晚上)(\d{1,2}):(\d{2}):(\d{2})\s+CST$/);
  if (!match) {
    const fallback = new Date(value);
    if (!Number.isNaN(fallback.valueOf())) return fallback;
    throw new Error("Unsupported private Maps activity timestamp format");
  }
  const [, yearText, monthText, dayText, period, hourText, minuteText, secondText] = match;
  let hour = Number(hourText);
  if (["下午", "晚上"].includes(period!) && hour < 12) hour += 12;
  if (["凌晨", "上午"].includes(period!) && hour === 12) hour = 0;
  if (period === "中午" && hour < 12) hour += 12;
  // Google Takeout rendered this export in the owner's Taiwan account timezone.
  const utcMilliseconds = Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    hour - 8,
    Number(minuteText),
    Number(secondText),
  );
  return new Date(utcMilliseconds);
}

export function extractGooglePlaceIds(url: string): string[] {
  const decoded = decodeHtml(url);
  const ids = new Set<string>();
  try {
    const parsed = new URL(decoded);
    for (const key of ["query_place_id", "ftid"]) {
      const value = parsed.searchParams.get(key);
      if (value) ids.add(value);
    }
  } catch {
    // Keep parsing embedded Maps data tokens below; malformed private URLs are ignored.
  }
  for (const match of decoded.matchAll(/!1s([^!/?&#]+)/g)) {
    const value = decodeURIComponent(match[1]!);
    if (value.length >= 10) ids.add(value);
  }
  return [...ids];
}

export function extractMapsViewportCoordinate(url: string): Coordinate | null {
  let decoded = decodeHtml(url);
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // A malformed private URL must not abort the review-data build.
  }
  const match = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

export function parseMapActivityHtml(html: string): MapActivity[] {
  const activities: MapActivity[] = [];
  const blockPattern = /<div class="outer-cell[\s\S]*?(?=<div class="outer-cell|<\/body>)/g;
  for (const blockMatch of html.matchAll(blockPattern)) {
    const block = blockMatch[0];
    const content = block.match(/<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">([\s\S]*?)<\/div>/)?.[1];
    if (!content) continue;
    const detail = content.match(/^([\s\S]*?)<a href="([^"]+)">([\s\S]*?)<\/a><br>([\s\S]*?)<br>/);
    if (!detail) continue;
    const actionLabel = plainText(detail[1]!);
    const action: MapActivityAction | undefined = actionLabel === "Searched for"
      ? "search"
      : actionLabel === "Viewed"
        ? "view"
        : actionLabel === "Directions to"
          ? "directions"
          : undefined;
    if (!action) continue;
    const title = plainText(detail[3]!);
    const url = decodeHtml(detail[2]!);
    let occurredAt: Date;
    try {
      occurredAt = parseTakeoutCstTimestamp(plainText(detail[4]!));
    } catch {
      continue;
    }
    activities.push({
      activityId: stableId("map-activity", action, occurredAt.toISOString(), url),
      action,
      title,
      url,
      occurredAt: occurredAt.toISOString(),
      googlePlaceIds: extractGooglePlaceIds(url),
    });
  }
  return activities;
}

export function normalizePoiName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function osmFeatureNames(feature: Pick<OsmFeature, "name" | "tags">): string[] {
  const aliases = new Set<string>([feature.name]);
  for (const [key, value] of Object.entries(feature.tags)) {
    if (key === "alt_name" || key === "official_name" || key === "short_name" || key === "brand" || key.startsWith("name:")) {
      for (const alias of value.split(";")) if (alias.trim()) aliases.add(alias.trim());
    }
  }
  return [...aliases];
}

function nameTokens(value: string): string[] {
  return normalizePoiName(value).split(" ").filter((token) => token.length >= 2);
}

export function matchPoiName(activityTitle: string, feature: Pick<OsmFeature, "name" | "tags">, contextName = ""): PoiNameMatch | null {
  const normalizedTitle = normalizePoiName(activityTitle);
  if (normalizedTitle.length < 3) return null;
  const allTitleSegments = activityTitle.split(",").map(normalizePoiName).filter((segment) => segment.length >= 3);
  const normalizedContext = normalizePoiName(contextName);
  const titleSegments = allTitleSegments[0] === normalizedContext && allTitleSegments[1]
    ? allTitleSegments.slice(0, 2)
    : allTitleSegments.slice(0, 1);
  let best: PoiNameMatch | null = null;
  for (const [index, alias] of osmFeatureNames(feature).entries()) {
    const normalizedAlias = normalizePoiName(alias);
    if (!normalizedAlias) continue;
    let match: PoiNameMatch | null = null;
    if (normalizedTitle === normalizedAlias || titleSegments.includes(normalizedAlias)) {
      match = { score: 1, method: index === 0 ? "exact" : "alias_exact", matchedAlias: alias };
    } else if (normalizedAlias.length >= 4 && titleSegments.some((segment) => segment.startsWith(normalizedAlias))) {
      match = { score: 0.96, method: "phrase_containment", matchedAlias: alias };
    } else {
      const aliasTokens = nameTokens(normalizedAlias);
      const aliasSet = new Set(aliasTokens);
      for (const segment of titleSegments) {
        const titleSet = new Set(nameTokens(segment));
        const intersection = [...titleSet].filter((token) => aliasSet.has(token)).length;
        const smallerTokenCount = Math.min(titleSet.size, aliasSet.size);
        const union = new Set([...titleSet, ...aliasSet]).size;
        const shorterNameLength = Math.min(segment.length, normalizedAlias.length);
        if (smallerTokenCount >= 2 && intersection === smallerTokenCount && shorterNameLength >= 6) {
          match = { score: 0.92, method: "token_containment", matchedAlias: alias };
          break;
        }
        if (intersection >= 2 && union > 0 && intersection / union >= 0.75) {
          match = { score: 0.85, method: "token_similarity", matchedAlias: alias };
          break;
        }
      }
    }
    if (match && (!best || match.score > best.score)) best = match;
  }
  return best;
}

function gapHours(timestamp: string, visits: Array<{ rawStart: string; rawEnd: string }>): number {
  const activityTime = Date.parse(timestamp);
  return Math.min(...visits.map((visit) => {
    const start = Date.parse(visit.rawStart);
    const end = Date.parse(visit.rawEnd);
    if (activityTime >= start && activityTime <= end) return 0;
    return Math.min(Math.abs(activityTime - start), Math.abs(activityTime - end)) / 3_600_000;
  }));
}

export function mapActivityEvidence(
  googlePlaceId: string,
  candidates: Array<{ name: string }>,
  visits: Array<{ rawStart: string; rawEnd: string }>,
  activities: MapActivity[],
): MapActivityEvidence {
  const candidateNames = candidates.map((candidate) => normalizePoiName(candidate.name));
  const relevant = activities.flatMap((activity) => {
    const normalizedTitle = normalizePoiName(activity.title);
    const candidateIndex = candidateNames.findIndex((name) => name.length >= 3 && name === normalizedTitle);
    const exactPlaceId = activity.googlePlaceIds.includes(googlePlaceId);
    if (!exactPlaceId && candidateIndex < 0) return [];
    const activityTime = Date.parse(activity.occurredAt);
    const precedesVisit = visits.some((visit) => activityTime <= Date.parse(visit.rawStart));
    return [{ activity, candidateIndex, exactPlaceId, precedesVisit, gapHours: gapHours(activity.occurredAt, visits) }];
  });
  const exactMatches = relevant.filter((row) => row.exactPlaceId);
  const nameMatches = relevant.filter((row) => row.candidateIndex >= 0);
  const preVisitNamedMatches = nameMatches.filter((row) => row.precedesVisit);
  const preVisitSearchMatches = nameMatches.filter((row) => row.activity.action === "search" && row.precedesVisit);
  const combinedNearMatch = relevant.some((row) => row.exactPlaceId && row.candidateIndex >= 0 && row.gapHours <= 24);
  const exactNearMatch = relevant.some((row) => row.exactPlaceId && row.gapHours <= 24);
  const nameNearMatch = relevant.some((row) => row.candidateIndex >= 0 && row.gapHours <= 24);
  const strength: MapActivityEvidence["strength"] = preVisitNamedMatches.length > 0 || combinedNearMatch
    ? "high"
    : exactNearMatch || exactMatches.length > 0 || nameNearMatch
      ? "medium"
      : nameMatches.length > 0
        ? "low"
        : "none";
  const candidateMatchCounts = candidates.map((_, index) => nameMatches.filter((row) => row.candidateIndex === index).length);
  const candidatePreVisitNamedMatchCounts = candidates.map((_, index) => preVisitNamedMatches.filter((row) => row.candidateIndex === index).length);
  const candidatePreVisitSearchMatchCounts = candidates.map((_, index) => preVisitSearchMatches.filter((row) => row.candidateIndex === index).length);
  const bestCandidateIndex = (counts: number[]): number | null => counts.reduce<number | null>((best, count, index) => {
    if (!count) return best;
    return best === null || count > counts[best]! ? index : best;
  }, null);
  const preVisitSearchCandidateIndex = bestCandidateIndex(candidatePreVisitSearchMatchCounts);
  const preVisitNamedCandidateIndex = preVisitSearchCandidateIndex ?? bestCandidateIndex(candidatePreVisitNamedMatchCounts);
  const matchedCandidateIndex = preVisitNamedCandidateIndex ?? bestCandidateIndex(candidateMatchCounts);
  const bestActivity = [...relevant].sort((a, b) =>
    Number(b.precedesVisit && b.candidateIndex >= 0) - Number(a.precedesVisit && a.candidateIndex >= 0)
    || Number(b.activity.action === "search") - Number(a.activity.action === "search")
    || Number(b.exactPlaceId) - Number(a.exactPlaceId)
    || Number(b.candidateIndex >= 0) - Number(a.candidateIndex >= 0)
    || a.gapHours - b.gapHours
  )[0];
  return {
    strength,
    relevantActivityCount: relevant.length,
    exactPlaceIdMatchCount: exactMatches.length,
    candidateNameMatchCount: nameMatches.length,
    preVisitSearchMatchCount: preVisitSearchMatches.length,
    preVisitNamedMatchCount: preVisitNamedMatches.length,
    nearestActivityGapHours: relevant.length ? Number(Math.min(...relevant.map((row) => row.gapHours)).toFixed(1)) : null,
    matchedName: bestActivity?.activity.title ?? "",
    matchedCandidate: matchedCandidateIndex === null ? null : matchedCandidateIndex + 1,
    preVisitSearchCandidate: preVisitSearchCandidateIndex === null ? null : preVisitSearchCandidateIndex + 1,
    preVisitNamedCandidate: preVisitNamedCandidateIndex === null ? null : preVisitNamedCandidateIndex + 1,
    activityTypes: [...new Set(relevant.map((row) => row.activity.action))].sort(),
    candidateMatchCounts,
    candidatePreVisitSearchMatchCounts,
    candidatePreVisitNamedMatchCounts,
  };
}

export function mapActivityAutoApproval(
  cityConfidence: CityCandidate["confidence"],
  candidates: RankedOsmCandidate[],
  evidence: MapActivityEvidence,
): { candidate: RankedOsmCandidate; selectedCandidate: number } | undefined {
  if (cityConfidence === "unresolved" || evidence.preVisitNamedCandidate === null) return undefined;
  const index = evidence.preVisitNamedCandidate - 1;
  const candidate = candidates[index];
  if (!candidate || candidate.category === "Other" || evidence.candidatePreVisitNamedMatchCounts[index]! < 1) return undefined;
  return { candidate, selectedCandidate: index + 1 };
}

export function timezoneForCountry(countryId: string): string {
  const timezone = COUNTRY_TIMEZONES[countryId];
  if (!timezone) throw new Error(`No timezone configured for country: ${countryId}`);
  return timezone;
}

export function localDateTime(timestamp: string, timezone: string): { date: string; dateTime: string } {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localDate = `${values.year}-${values.month}-${values.day}`;
  return { date: localDate, dateTime: `${localDate} ${values.hour}:${values.minute}:${values.second}` };
}

export function isReviewDate(date: string): boolean {
  return date >= REVIEW_START_DATE && date <= REVIEW_END_DATE;
}

export function assignCity(point: Coordinate, cities: TravelCity[]): CityCandidate {
  const ranked = cities
    .map((city) => ({ city, distanceKm: haversineKm(point, city.location) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const first = ranked[0];
  if (!first) throw new Error("No Travel Map cities are available");
  const secondDistanceKm = ranked[1]?.distanceKm ?? null;
  const unambiguous = secondDistanceKm === null
    || secondDistanceKm - first.distanceKm >= 5
    || secondDistanceKm >= first.distanceKm * 1.5;
  const confidence = first.distanceKm <= 10 && unambiguous
    ? "high"
    : first.distanceKm <= 35
      ? "medium"
      : first.distanceKm <= 50
        ? "low"
        : "unresolved";
  return { ...first, distanceKm: first.distanceKm, confidence, secondDistanceKm };
}

const RESTAURANTS = new Set(["restaurant", "cafe", "bar", "pub", "food_court", "ice_cream", "biergarten"]);
const STATIONS = new Set(["station", "halt", "tram_stop", "subway_entrance"]);
const ATTRACTION_TOURISM = new Set(["attraction", "museum", "gallery", "zoo", "aquarium", "theme_park", "viewpoint", "artwork"]);

export function classifyOsmTags(tags: Record<string, string>): { category: PoiCategory; subcategory: string } {
  if (tags.amenity === "fast_food") return { category: "Takeaway", subcategory: "fast_food" };
  const amenity = tags.amenity;
  const railway = tags.railway;
  const tourism = tags.tourism;
  const leisure = tags.leisure;
  const natural = tags.natural;
  if (amenity && RESTAURANTS.has(amenity)) return { category: "Restaurant", subcategory: amenity };
  if ((railway && STATIONS.has(railway)) || amenity === "bus_station" || amenity === "ferry_terminal") {
    return { category: "Station", subcategory: railway ?? amenity ?? "station" };
  }
  if (tags.public_transport === "station" || tags.public_transport === "platform" || tags.public_transport === "stop_position") {
    return { category: "Station", subcategory: tags.public_transport };
  }
  if (tags.shop === "mall") return { category: "Shopping Mall", subcategory: "mall" };
  if (tags.shop === "supermarket") return { category: "Supermarket", subcategory: "supermarket" };
  if (tags.shop === "convenience") return { category: "Convenience Store", subcategory: "convenience" };
  if (tags.shop) return { category: "Shop", subcategory: tags.shop };
  if (tourism && ATTRACTION_TOURISM.has(tourism)) return { category: "Attraction", subcategory: tourism };
  if (tags.historic) return { category: "Attraction", subcategory: tags.historic };
  if (amenity && ["place_of_worship", "theatre", "arts_centre", "cinema", "marketplace"].includes(amenity)) {
    return { category: "Attraction", subcategory: amenity };
  }
  if (leisure && ["park", "garden", "nature_reserve", "stadium"].includes(leisure)) {
    return { category: "Attraction", subcategory: leisure };
  }
  if (natural && ["beach", "peak", "cave_entrance"].includes(natural)) {
    return { category: "Attraction", subcategory: natural };
  }
  return { category: "Other", subcategory: tags.tourism ?? tags.amenity ?? tags.railway ?? tags.shop ?? "unknown" };
}

export function rankOsmCandidates(point: Coordinate, features: OsmFeature[], limit = 3): RankedOsmCandidate[] {
  return features
    .map((feature) => ({
      ...feature,
      distanceMeters: Math.round(haversineKm(point, feature) * 1_000),
    }))
    .filter((feature) => feature.distanceMeters <= 250)
    .sort((a, b) => a.distanceMeters - b.distanceMeters || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function mayAutoApprove(cityConfidence: CityCandidate["confidence"], candidates: RankedOsmCandidate[]): boolean {
  const first = candidates[0];
  if (cityConfidence !== "high" || !first || first.category === "Other" || first.distanceMeters > 25) return false;
  const second = candidates[1];
  return !second || second.distanceMeters >= Math.max(50, first.distanceMeters * 2);
}
