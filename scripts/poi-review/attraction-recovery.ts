import { haversineKm } from "../preprocess/geo.ts";
import {
  assignCity,
  extractMapsViewportCoordinate,
  matchPoiName,
  normalizePoiName,
  stableId,
  type Coordinate,
  type MapActivity,
  type OsmFeature,
  type PoiCategory,
  type PoiNameMatch,
  type TravelCity,
} from "./model.ts";

export type TimelineEvidenceSource = "timeline_path" | "raw_position" | "semantic_visit";

export type TimelineEvidencePoint = Coordinate & {
  occurredAt: string;
  source: TimelineEvidenceSource;
  accuracyMeters: number | null;
};

export type TimelineForRecovery = {
  semanticSegments: Array<{
    startTime?: string;
    endTime?: string;
    timelinePath?: Array<{ point: string; time: string }>;
    visit?: { topCandidate?: { placeLocation?: { latLng?: string } } };
  }>;
  rawSignals?: Array<{
    position?: { LatLng?: string; timestamp?: string; accuracyMeters?: number };
  }>;
};

export type ExistingPoiReference = {
  poiId: string;
  reviewStatus: string;
  selectedOsmId: string;
  candidateOsmIds: string[];
};

export type SearchedPoiRecoveryRow = {
  recoveryId: string;
  sourceKey: string;
  googlePlaceId: string;
  cityId: string;
  city: string;
  osmId: string;
  osmUrl: string;
  name: string;
  category: "Attraction" | "Unclassified";
  subcategory: string;
  latitude: number;
  longitude: number;
  matchedOsmName: string;
  matchedOsmCategory: PoiCategory | "";
  matchedAlias: string;
  nameMatchMethod: PoiNameMatch["method"] | "none";
  nameMatchScore: number;
  mapsActivityCount: number;
  mapsActivityTypes: MapActivity["action"][];
  nearestTimelineDistanceMeters: number;
  nearestEvidenceGapHours: number;
  samplesWithin75Meters: number;
  samplesWithin200Meters: number;
  samplesWithin350Meters: number;
  semanticVisitsWithin200Meters: number;
  closestEvidenceSource: TimelineEvidenceSource;
  evidenceConfidence: "high";
  proposedAction: "proposed_auto_approve";
  existingPoiId: string;
  existingReviewStatus: string;
  existingSelectedCandidate: boolean;
  newCandidate: boolean;
};

const REVIEW_START = Date.parse("2025-09-29T16:00:00Z");
const REVIEW_END = Date.parse("2026-03-31T16:00:00Z");
const EVIDENCE_RADIUS_METERS = 350;
const OSM_CLASSIFICATION_RADIUS_METERS = 350;
const EVIDENCE_GRID_DEGREES = 0.01;

function parseCoordinate(value: string | undefined): Coordinate | null {
  if (!value) return null;
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\D+\s*(-?\d+(?:\.\d+)?)/u);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function inReviewPeriod(timestamp: string | undefined): timestamp is string {
  if (!timestamp) return false;
  const time = Date.parse(timestamp);
  return Number.isFinite(time) && time >= REVIEW_START && time < REVIEW_END;
}

export function collectTimelineEvidence(timeline: TimelineForRecovery): TimelineEvidencePoint[] {
  const evidence: TimelineEvidencePoint[] = [];
  for (const segment of timeline.semanticSegments) {
    for (const pathPoint of segment.timelinePath ?? []) {
      const coordinate = parseCoordinate(pathPoint.point);
      if (coordinate && inReviewPeriod(pathPoint.time)) {
        evidence.push({ ...coordinate, occurredAt: pathPoint.time, source: "timeline_path", accuracyMeters: null });
      }
    }
    const visitCoordinate = parseCoordinate(segment.visit?.topCandidate?.placeLocation?.latLng);
    if (visitCoordinate && inReviewPeriod(segment.startTime)) {
      evidence.push({ ...visitCoordinate, occurredAt: segment.startTime, source: "semantic_visit", accuracyMeters: null });
    }
  }
  for (const signal of timeline.rawSignals ?? []) {
    const position = signal.position;
    const coordinate = parseCoordinate(position?.LatLng);
    if (coordinate && inReviewPeriod(position?.timestamp)) {
      evidence.push({
        ...coordinate,
        occurredAt: position.timestamp,
        source: "raw_position",
        accuracyMeters: Number.isFinite(position.accuracyMeters) ? position.accuracyMeters! : null,
      });
    }
  }
  return evidence.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
}

function evidenceCell(latitude: number, longitude: number): string {
  return `${Math.floor(latitude / EVIDENCE_GRID_DEGREES)}:${Math.floor(longitude / EVIDENCE_GRID_DEGREES)}`;
}

function indexEvidence(points: TimelineEvidencePoint[]): Map<string, TimelineEvidencePoint[]> {
  const index = new Map<string, TimelineEvidencePoint[]>();
  for (const point of points) {
    const key = evidenceCell(point.latitude, point.longitude);
    const rows = index.get(key) ?? [];
    rows.push(point);
    index.set(key, rows);
  }
  return index;
}

function nearbyEvidence(location: Coordinate, index: Map<string, TimelineEvidencePoint[]>): TimelineEvidencePoint[] {
  const latitudeCell = Math.floor(location.latitude / EVIDENCE_GRID_DEGREES);
  const longitudeCell = Math.floor(location.longitude / EVIDENCE_GRID_DEGREES);
  const points: TimelineEvidencePoint[] = [];
  for (let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset += 1) {
    for (let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset += 1) {
      points.push(...(index.get(`${latitudeCell + latitudeOffset}:${longitudeCell + longitudeOffset}`) ?? []));
    }
  }
  return points;
}

type MeasuredEvidence = {
  nearestDistanceMeters: number;
  nearestGapHours: number;
  closestSource: TimelineEvidenceSource;
  within75: number;
  within200: number;
  within350: number;
  visitsWithin200: number;
};

function measureEvidence(
  activity: MapActivity,
  location: Coordinate,
  evidenceIndex: Map<string, TimelineEvidencePoint[]>,
): MeasuredEvidence | null {
  const activityTime = Date.parse(activity.occurredAt);
  const nearby = nearbyEvidence(location, evidenceIndex).flatMap((point) => {
    const pointTime = Date.parse(point.occurredAt);
    const distanceMeters = Math.round(haversineKm(point, location) * 1_000);
    return distanceMeters <= EVIDENCE_RADIUS_METERS ? [{ point, pointTime, distanceMeters }] : [];
  });
  if (!nearby.length) return null;
  nearby.sort((a, b) => a.distanceMeters - b.distanceMeters
    || Math.abs(a.pointTime - activityTime) - Math.abs(b.pointTime - activityTime));
  const nearest = nearby[0]!;
  return {
    nearestDistanceMeters: nearest.distanceMeters,
    nearestGapHours: Number((Math.abs(nearest.pointTime - activityTime) / 3_600_000).toFixed(1)),
    closestSource: nearest.point.source,
    within75: nearby.filter((row) => row.distanceMeters <= 75).length,
    within200: nearby.filter((row) => row.distanceMeters <= 200).length,
    within350: nearby.length,
    visitsWithin200: nearby.filter((row) => row.distanceMeters <= 200 && row.point.source === "semantic_visit").length,
  };
}

export function googleMapsDisplayName(title: string, cityName: string): string {
  const segments = title.split(",").map((segment) => segment.trim()).filter(Boolean);
  if (!segments.length) return title.trim();
  if (segments[1] && normalizePoiName(segments[0]!) === normalizePoiName(cityName)) return segments[1]!;
  return segments[0]!;
}

type ClassifiedFeature = {
  feature: OsmFeature;
  match: PoiNameMatch;
  distanceMeters: number;
};

function classifyFromOsm(
  activity: MapActivity,
  cityName: string,
  viewport: Coordinate,
  features: OsmFeature[],
): ClassifiedFeature | undefined {
  return features.flatMap((feature): ClassifiedFeature[] => {
    const distanceMeters = Math.round(haversineKm(viewport, feature) * 1_000);
    if (distanceMeters > OSM_CLASSIFICATION_RADIUS_METERS) return [];
    const match = matchPoiName(activity.title, feature, cityName);
    return match ? [{ feature, match, distanceMeters }] : [];
  }).sort((left, right) =>
    right.match.score - left.match.score
    || left.distanceMeters - right.distanceMeters
    || left.feature.name.localeCompare(right.feature.name)
  )[0];
}

function recoverySourceKey(activity: MapActivity, cityId: string, displayName: string): string {
  const placeId = activity.googlePlaceIds[0];
  return placeId ? `google:${placeId}` : `maps:${cityId}:${normalizePoiName(displayName)}`;
}

export function recoverSearchedPois(options: {
  activities: MapActivity[];
  cities: TravelCity[];
  snapshots: Map<string, { features: OsmFeature[] }>;
  evidence: TimelineEvidencePoint[];
  existingPois: ExistingPoiReference[];
}): SearchedPoiRecoveryRow[] {
  const recoveredBySource = new Map<string, SearchedPoiRecoveryRow>();
  const evidenceIndex = indexEvidence(options.evidence);
  for (const activity of options.activities) {
    if (activity.action !== "search" && activity.action !== "directions") continue;
    const viewport = extractMapsViewportCoordinate(activity.url);
    if (!viewport) continue;
    const cityCandidate = assignCity(viewport, options.cities);
    if (cityCandidate.confidence === "unresolved") continue;
    const displayName = googleMapsDisplayName(activity.title, cityCandidate.city.name);
    if (!displayName || normalizePoiName(displayName) === normalizePoiName(cityCandidate.city.name)) continue;
    const measured = measureEvidence(activity, viewport, evidenceIndex);
    if (!measured) continue;

    const classified = classifyFromOsm(
      activity,
      cityCandidate.city.name,
      viewport,
      options.snapshots.get(cityCandidate.city.id)?.features ?? [],
    );
    const attraction = classified?.feature.category === "Attraction" ? classified.feature : undefined;
    const location = attraction ?? viewport;
    const sourceKey = recoverySourceKey(activity, cityCandidate.city.id, displayName);
    const existing = attraction
      ? options.existingPois.find((poi) => poi.candidateOsmIds.includes(attraction.osmId))
      : undefined;
    const prior = recoveredBySource.get(sourceKey);
    const activityTypes = [...new Set([...(prior?.mapsActivityTypes ?? []), activity.action])].sort();
    const mapsActivityCount = (prior?.mapsActivityCount ?? 0) + 1;
    const candidate: SearchedPoiRecoveryRow = {
      recoveryId: stableId("searched-poi", sourceKey),
      sourceKey,
      googlePlaceId: activity.googlePlaceIds[0] ?? "",
      cityId: cityCandidate.city.id,
      city: cityCandidate.city.name,
      osmId: attraction?.osmId ?? "",
      osmUrl: attraction?.osmUrl ?? "",
      name: displayName,
      category: attraction ? "Attraction" : "Unclassified",
      subcategory: attraction?.subcategory ?? "unclassified",
      latitude: location.latitude,
      longitude: location.longitude,
      matchedOsmName: classified?.feature.name ?? "",
      matchedOsmCategory: classified?.feature.category ?? "",
      matchedAlias: classified?.match.matchedAlias ?? "",
      nameMatchMethod: classified?.match.method ?? "none",
      nameMatchScore: classified?.match.score ?? 0,
      mapsActivityCount,
      mapsActivityTypes: activityTypes,
      nearestTimelineDistanceMeters: measured.nearestDistanceMeters,
      nearestEvidenceGapHours: measured.nearestGapHours,
      samplesWithin75Meters: measured.within75,
      samplesWithin200Meters: measured.within200,
      samplesWithin350Meters: measured.within350,
      semanticVisitsWithin200Meters: measured.visitsWithin200,
      closestEvidenceSource: measured.closestSource,
      evidenceConfidence: "high",
      proposedAction: "proposed_auto_approve",
      existingPoiId: existing?.poiId ?? "",
      existingReviewStatus: existing?.reviewStatus ?? "",
      existingSelectedCandidate: Boolean(existing && existing.selectedOsmId === attraction?.osmId),
      newCandidate: !existing,
    };
    if (!prior || candidate.nearestTimelineDistanceMeters < prior.nearestTimelineDistanceMeters) {
      recoveredBySource.set(sourceKey, candidate);
    } else {
      recoveredBySource.set(sourceKey, { ...prior, mapsActivityCount, mapsActivityTypes: activityTypes });
    }
  }
  return [...recoveredBySource.values()].sort((left, right) =>
    left.city.localeCompare(right.city)
    || left.category.localeCompare(right.category)
    || left.name.localeCompare(right.name)
  );
}
