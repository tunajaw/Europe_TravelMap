import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assignCity,
  classifyOsmTags,
  isReviewDate,
  localDateTime,
  mapActivityAutoApproval,
  mapActivityEvidence,
  mayAutoApprove,
  parseMapActivityHtml,
  parseLatLng,
  rankOsmCandidates,
  stableId,
  timezoneForCountry,
  type Coordinate,
  type OsmFeature,
  type TravelCity,
} from "./model.ts";
import {
  collectTimelineEvidence,
  recoverSearchedPois,
  type TimelineForRecovery,
} from "./attraction-recovery.ts";

const ROOT = process.cwd();
const TIMELINE_PATH = path.join(ROOT, "data/raw/timeline.json");
const MAP_ACTIVITY_PATH = path.join(ROOT, "data/raw/map_search.html");
const TRAVEL_DATA_PATH = path.join(ROOT, "public/data/travel-data.json");
const OUTPUT_DIR = path.join(ROOT, "data/generated/poi-review");
const CACHE_DIR = path.join(OUTPUT_DIR, "osm-cache");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "review-data.json");

type TimelineVisit = {
  startTime: string;
  endTime: string;
  visit: {
    hierarchyLevel?: number;
    probability?: number;
    topCandidate: {
      placeId: string;
      semanticType?: string;
      probability?: number;
      placeLocation: { latLng: string };
    };
  };
};

type TimelineData = Omit<TimelineForRecovery, "semanticSegments"> & {
  semanticSegments: Array<TimelineVisit & TimelineForRecovery["semanticSegments"][number]>;
};

type VisitRow = {
  visitId: string;
  poiId: string;
  googlePlaceId: string;
  cityId: string;
  city: string;
  cityConfidence: string;
  rawStart: string;
  rawEnd: string;
  localStart: string;
  localEnd: string;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  visitProbability: number | null;
  placeProbability: number | null;
  hierarchyLevel: number | null;
};

function median(values: number[]): number {
  if (!values.length) throw new Error("Cannot calculate a median for an empty collection");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function slug(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function overpassQueries(city: TravelCity): string[] {
  const { latitude, longitude } = city.location;
  const latitudeSpan = 0.05;
  const longitudeSpan = latitudeSpan / Math.max(Math.cos(latitude * Math.PI / 180), 0.35);
  const bbox = `${latitude - latitudeSpan},${longitude - longitudeSpan},${latitude + latitudeSpan},${longitude + longitudeSpan}`;
  const wrap = (body: string): string => `[out:json][timeout:120];
(
${body}
);
out center;`;
  return [wrap(`
  nwr(${bbox})["name"]["tourism"];
  nwr(${bbox})["name"]["historic"];
  nwr(${bbox})["name"]["amenity"~"^(restaurant|cafe|bar|pub|food_court|ice_cream|biergarten|fast_food|place_of_worship|theatre|arts_centre|cinema|marketplace)$"];
  nwr(${bbox})["name"]["leisure"~"^(park|garden|nature_reserve|stadium)$"];
  nwr(${bbox})["name"]["natural"~"^(beach|peak|cave_entrance)$"];
`), wrap(`
  nwr(${bbox})["name"]["amenity"~"^(bus_station|ferry_terminal)$"];
  nwr(${bbox})["name"]["railway"~"^(station|halt|tram_stop|subway_entrance)$"];
  nwr(${bbox})["name"]["public_transport"="station"];
`), wrap(`
  nwr(${bbox})["name"]["shop"];
`)];
}

async function fetchSnapshot(city: TravelCity, offline: boolean): Promise<{ downloadedAt: string; features: OsmFeature[]; downloadError?: string }> {
  const cachePath = path.join(CACHE_DIR, `${slug(city.id)}.json`);
  try {
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (offline) {
    return { downloadedAt: new Date().toISOString(), features: [], downloadError: "No cached OSM snapshot" };
  }
  const endpoints = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  let lastError: unknown;
  const elements: Array<Record<string, unknown>> = [];
  for (const [queryIndex, query] of overpassQueries(city).entries()) {
    let queryElements: Array<Record<string, unknown>> | undefined;
    const queryCachePath = path.join(CACHE_DIR, `${slug(city.id)}-${queryIndex + 1}.json`);
    try {
      queryElements = JSON.parse(await readFile(queryCachePath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (queryElements) {
      elements.push(...queryElements);
      continue;
    }
    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint}?data=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
          headers: { "User-Agent": "Europe-TravelMap-POI-Review/1.0" },
          signal: AbortSignal.timeout(35_000),
        });
        if (!response.ok) {
          const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 300);
          throw new Error(`Overpass ${response.status} ${response.statusText}: ${detail}`);
        }
        const payload = await response.json() as { elements: Array<Record<string, unknown>> };
        queryElements = payload.elements;
        await writeFile(queryCachePath, `${JSON.stringify(queryElements)}\n`, "utf8");
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
    if (!queryElements) {
      const message = lastError instanceof Error ? lastError.message : String(lastError);
      process.stderr.write(`OSM snapshot unavailable for ${city.name}: ${message}\n`);
      return { downloadedAt: new Date().toISOString(), features: [], downloadError: message };
    }
    elements.push(...queryElements);
  }
  const seen = new Set<string>();
  const features = elements.flatMap((element): OsmFeature[] => {
        const identity = `${element.type}/${element.id}`;
        if (seen.has(identity)) return [];
        seen.add(identity);
        const tags = (element.tags ?? {}) as Record<string, string>;
        const center = element.center as Coordinate | undefined;
        const latitude = Number(element.lat ?? center?.latitude ?? (center as unknown as { lat?: number })?.lat);
        const longitude = Number(element.lon ?? center?.longitude ?? (center as unknown as { lon?: number })?.lon);
        if (!tags.name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
        const classification = classifyOsmTags(tags);
        return [{
          osmId: identity,
          osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
          name: tags.name,
          ...classification,
          latitude,
          longitude,
          tags,
        }];
      });
  const snapshot = { downloadedAt: new Date().toISOString(), features };
  await writeFile(cachePath, `${JSON.stringify(snapshot)}\n`, "utf8");
  return snapshot;
}

async function main(): Promise<void> {
  const offline = process.argv.includes("--offline");
  await mkdir(CACHE_DIR, { recursive: true });
  const [timeline, travelData, mapActivityHtml] = await Promise.all([
    readFile(TIMELINE_PATH, "utf8").then(JSON.parse) as Promise<TimelineData>,
    readFile(TRAVEL_DATA_PATH, "utf8").then(JSON.parse) as Promise<{ cities: TravelCity[] }>,
    readFile(MAP_ACTIVITY_PATH, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    }),
  ]);
  const reviewMapActivities = mapActivityHtml
    ? parseMapActivityHtml(mapActivityHtml).filter((activity) => {
        const time = Date.parse(activity.occurredAt);
        return time >= Date.parse("2025-09-29T16:00:00Z") && time < Date.parse("2026-03-31T16:00:00Z");
      })
    : [];

  const candidateVisits = timeline.semanticSegments.filter((segment): segment is TimelineVisit => Boolean(segment.visit?.topCandidate?.placeId && segment.visit?.topCandidate?.placeLocation?.latLng));
  const provisional = candidateVisits.map((segment) => {
    const coordinate = parseLatLng(segment.visit.topCandidate.placeLocation.latLng);
    const cityCandidate = assignCity(coordinate, travelData.cities);
    const timezone = timezoneForCountry(cityCandidate.city.countryId);
    const localStart = localDateTime(segment.startTime, timezone);
    const localEnd = localDateTime(segment.endTime, timezone);
    return { segment, coordinate, cityCandidate, localStart, localEnd };
  }).filter((row) => isReviewDate(row.localStart.date));

  const visits: VisitRow[] = provisional.map(({ segment, coordinate, cityCandidate, localStart, localEnd }) => ({
    visitId: stableId("visit", segment.visit.topCandidate.placeId, segment.startTime, segment.endTime, segment.visit.hierarchyLevel ?? ""),
    poiId: stableId("poi", segment.visit.topCandidate.placeId),
    googlePlaceId: segment.visit.topCandidate.placeId,
    cityId: cityCandidate.city.id,
    city: cityCandidate.city.name,
    cityConfidence: cityCandidate.confidence,
    rawStart: segment.startTime,
    rawEnd: segment.endTime,
    localStart: localStart.dateTime,
    localEnd: localEnd.dateTime,
    durationMinutes: Math.max(0, Math.round((Date.parse(segment.endTime) - Date.parse(segment.startTime)) / 60_000)),
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    visitProbability: segment.visit.probability ?? null,
    placeProbability: segment.visit.topCandidate.probability ?? null,
    hierarchyLevel: segment.visit.hierarchyLevel ?? null,
  }));

  const cityIds = [...new Set(visits.filter((visit) => visit.cityConfidence !== "unresolved").map((visit) => visit.cityId))].sort();
  const snapshots = new Map<string, Awaited<ReturnType<typeof fetchSnapshot>>>();
  let nextCityIndex = 0;
  const downloadWorker = async (): Promise<void> => {
    while (nextCityIndex < cityIds.length) {
      const index = nextCityIndex++;
      const cityId = cityIds[index]!;
      const city = travelData.cities.find((candidate) => candidate.id === cityId)!;
      process.stdout.write(`[${index + 1}/${cityIds.length}] OSM ${city.name}\n`);
      snapshots.set(cityId, await fetchSnapshot(city, offline));
      if (!offline) await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  };
  await Promise.all(Array.from({ length: offline ? 1 : 2 }, downloadWorker));

  const visitsByPlace = new Map<string, VisitRow[]>();
  for (const visit of visits) {
    const rows = visitsByPlace.get(visit.googlePlaceId) ?? [];
    rows.push(visit);
    visitsByPlace.set(visit.googlePlaceId, rows);
  }
  const pois = [...visitsByPlace.entries()].map(([googlePlaceId, rows]) => {
    const latitude = median(rows.map((row) => row.latitude));
    const longitude = median(rows.map((row) => row.longitude));
    const city = travelData.cities.find((candidate) => candidate.id === rows[0]!.cityId)!;
    const cityCandidate = assignCity({ latitude, longitude }, travelData.cities);
    const candidates = rankOsmCandidates({ latitude, longitude }, snapshots.get(city.id)?.features ?? []);
    const mapsEvidence = mapActivityEvidence(googlePlaceId, candidates, rows, reviewMapActivities);
    const first = candidates[0];
    const spatialAutoApproved = mayAutoApprove(cityCandidate.confidence, candidates);
    const mapsAutoApproval = mapActivityAutoApproval(cityCandidate.confidence, candidates, mapsEvidence);
    const autoApproved = spatialAutoApproved || Boolean(mapsAutoApproval);
    const approvedCandidate = spatialAutoApproved ? first : mapsAutoApproval?.candidate;
    const selectedCandidate = spatialAutoApproved ? 1 : mapsAutoApproval?.selectedCandidate ?? "";
    const reviewStatus = autoApproved ? "auto_approved" : candidates.length ? "needs_review" : "unresolved";
    const overallConfidence = autoApproved ? "high" : first && first.distanceMeters <= 75 && cityCandidate.confidence !== "unresolved" ? "medium" : "low";
    const reviewPriority = reviewStatus === "auto_approved" ? 4 : overallConfidence === "low" ? 1 : overallConfidence === "medium" ? 2 : 3;
    return {
      poiId: stableId("poi", googlePlaceId),
      googlePlaceId,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodeURIComponent(googlePlaceId)}`,
      latitude,
      longitude,
      cityId: city.id,
      city: city.name,
      cityDistanceKm: Number(cityCandidate.distanceKm.toFixed(2)),
      secondCityDistanceKm: cityCandidate.secondDistanceKm === null ? null : Number(cityCandidate.secondDistanceKm.toFixed(2)),
      cityConfidence: cityCandidate.confidence,
      visitCount: rows.length,
      firstVisitLocal: rows.map((row) => row.localStart).sort()[0],
      lastVisitLocal: rows.map((row) => row.localEnd).sort().at(-1),
      totalDurationMinutes: rows.reduce((sum, row) => sum + row.durationMinutes, 0),
      matchConfidence: mapsAutoApproval ? "high" : first ? (first.distanceMeters <= 25 ? "high" : first.distanceMeters <= 75 ? "medium" : "low") : "unresolved",
      categoryConfidence: mapsAutoApproval ? "high" : first ? (first.category === "Other" ? "low" : "medium") : "unresolved",
      overallConfidence,
      reviewPriority,
      reviewStatus,
      displayName: approvedCandidate?.name ?? "",
      category: approvedCandidate?.category ?? "",
      subcategory: approvedCandidate?.subcategory ?? "",
      includeInCityMap: approvedCandidate && ["Attraction", "Restaurant"].includes(approvedCandidate.category) ? "Yes" : "No",
      selectedCandidate,
      reviewerNotes: "",
      mapsEvidence,
      candidates: candidates.map((candidate, index) => ({
        ...candidate,
        mapsActivityMatchCount: mapsEvidence.candidateMatchCounts[index] ?? 0,
      })),
    };
  }).sort((a, b) => a.reviewPriority - b.reviewPriority || a.city.localeCompare(b.city) || a.poiId.localeCompare(b.poiId));

  const timelineEvidence = collectTimelineEvidence(timeline);
  const searchedPoiRecovery = recoverSearchedPois({
    activities: reviewMapActivities,
    cities: travelData.cities,
    snapshots,
    evidence: timelineEvidence,
    existingPois: pois.map((poi) => ({
      poiId: poi.poiId,
      reviewStatus: poi.reviewStatus,
      selectedOsmId: typeof poi.selectedCandidate === "number" ? poi.candidates[poi.selectedCandidate - 1]?.osmId ?? "" : "",
      candidateOsmIds: poi.candidates.map((candidate) => candidate.osmId),
    })),
  });

  const categoryMapping = [
    ["Attraction", "tourism, historic, selected amenity/leisure/natural", "Visible in the current City Map"],
    ["Restaurant", "restaurant, cafe, bar, pub, food_court, ice_cream, biergarten", "Processed; planned as the next visible category"],
    ["Station", "railway/public_transport/bus_station/ferry_terminal", "Processed; initially hidden"],
    ["Takeaway", "amenity=fast_food", "Processed; initially hidden"],
    ["Shopping Mall", "shop=mall", "Processed; initially hidden"],
    ["Supermarket", "shop=supermarket", "Processed; initially hidden"],
    ["Convenience Store", "shop=convenience", "Processed; initially hidden"],
    ["Shop", "other named shop=*", "Processed; initially hidden"],
    ["Unclassified", "Search or Directions followed by Timeline evidence within 350 m; no reliable Attraction classification", "Visible in the City Map with a distinct marker"],
  ].map(([category, source, displayRule]) => ({ category, source, displayRule }));

  const output = {
    generatedAt: new Date().toISOString(),
    reviewPeriod: { start: "2025-09-30", end: "2026-03-31" },
    sources: {
      timeline: "data/raw/timeline.json",
      privateMapsActivity: mapActivityHtml ? "data/raw/map_search.html (private; aggregated matches only)" : "not provided",
      travelCities: "public/data/travel-data.json",
      osm: "OpenStreetMap via cached city-level Overpass snapshots",
    },
    summary: {
      visits: visits.length,
      uniquePois: pois.length,
      citiesQueried: cityIds.length,
      osmSnapshotsUnavailable: [...snapshots.values()].filter((snapshot) => snapshot.downloadError).length,
      autoApproved: pois.filter((poi) => poi.reviewStatus === "auto_approved").length,
      needsReview: pois.filter((poi) => poi.reviewStatus === "needs_review").length,
      unresolved: pois.filter((poi) => poi.reviewStatus === "unresolved").length,
      privateMapsActivitiesInPeriod: reviewMapActivities.length,
      poisWithHighMapsEvidence: pois.filter((poi) => poi.mapsEvidence.strength === "high").length,
      poisWithMediumMapsEvidence: pois.filter((poi) => poi.mapsEvidence.strength === "medium").length,
      poisWithLowMapsEvidence: pois.filter((poi) => poi.mapsEvidence.strength === "low").length,
      searchedPoiRecoveryCandidates: searchedPoiRecovery.length,
      searchedPoiRecoveryAttractions: searchedPoiRecovery.filter((row) => row.category === "Attraction").length,
      searchedPoiRecoveryUnclassified: searchedPoiRecovery.filter((row) => row.category === "Unclassified").length,
      searchedPoiRecoveryNewCandidates: searchedPoiRecovery.filter((row) => row.newCandidate).length,
    },
    pois,
    visits,
    searchedPoiRecovery,
    categoryMapping,
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${OUTPUT_PATH}\n${JSON.stringify(output.summary)}\n`);
}

await main();
