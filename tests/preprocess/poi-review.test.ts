import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assignCity,
  classifyOsmTags,
  extractMapsViewportCoordinate,
  isReviewDate,
  localDateTime,
  mapActivityAutoApproval,
  mapActivityEvidence,
  matchPoiName,
  mayAutoApprove,
  parseMapActivityHtml,
  parseLatLng,
  parseTakeoutCstTimestamp,
  stableId,
  type TravelCity,
} from "../../scripts/poi-review/model.ts";
import {
  collectTimelineEvidence,
  googleMapsDisplayName,
  recoverSearchedPois,
} from "../../scripts/poi-review/attraction-recovery.ts";
import { localizedPoiName } from "../../scripts/poi-review/localized-name.ts";
import {
  applyGooglePlaceCoordinateOverride,
  extractResolvedGoogleMapsLocation,
  manualPoiNameHash,
  mergeManualPoiReferences,
  parseManualPoiSource,
  prunePublicPoiReferences,
} from "../../scripts/poi-review/manual-pois.ts";

describe("POI review preprocessing", () => {
  it("prefers OSM Traditional Chinese, then Chinese, and otherwise preserves the source name", () => {
    expect(localizedPoiName("Original", { "name:zh-Hant": "繁體名稱", "name:zh": "中文名稱" }))
      .toEqual({ name: "繁體名稱", originalName: "Original", language: "zh-Hant" });
    expect(localizedPoiName("Original", { "name:zh": "中文名稱" }))
      .toEqual({ name: "中文名稱", originalName: "Original", language: "zh" });
    expect(localizedPoiName("Original", { "name:en": "English" }))
      .toEqual({ name: "Original", originalName: "Original", language: "source" });
  });

  it("parses Timeline coordinates and creates stable opaque IDs", () => {
    expect(parseLatLng("48.1372°, 11.5756°")).toEqual({ latitude: 48.1372, longitude: 11.5756 });
    expect(stableId("poi", "place-a")).toBe(stableId("poi", "place-a"));
    expect(stableId("poi", "place-a")).not.toBe(stableId("poi", "place-b"));
  });

  it("applies the inclusive local review-date cutoff", () => {
    expect(localDateTime("2026-03-31T23:30:00Z", "Europe/Berlin").date).toBe("2026-04-01");
    expect(isReviewDate("2025-09-30")).toBe(true);
    expect(isReviewDate("2026-03-31")).toBe(true);
    expect(isReviewDate("2026-04-01")).toBe(false);
  });

  it("marks close and unambiguous city assignments as high confidence", () => {
    const cities: TravelCity[] = [
      { id: "a", name: "A", countryId: "germany", location: { latitude: 48, longitude: 11 } },
      { id: "b", name: "B", countryId: "germany", location: { latitude: 49, longitude: 12 } },
    ];
    expect(assignCity({ latitude: 48.01, longitude: 11.01 }, cities).confidence).toBe("high");
  });

  it("separates visible and hidden-first-pass OSM categories", () => {
    expect(classifyOsmTags({ tourism: "museum" }).category).toBe("Attraction");
    expect(classifyOsmTags({ amenity: "restaurant" }).category).toBe("Restaurant");
    expect(classifyOsmTags({ amenity: "fast_food" }).category).toBe("Takeaway");
    expect(classifyOsmTags({ railway: "station" }).category).toBe("Station");
  });

  it("only auto-approves a unique close explicit match in a high-confidence city", () => {
    const candidate = {
      osmId: "node/1",
      osmUrl: "https://www.openstreetmap.org/node/1",
      name: "Museum",
      category: "Attraction" as const,
      subcategory: "museum",
      latitude: 48,
      longitude: 11,
      tags: { tourism: "museum" },
      distanceMeters: 10,
    };
    expect(mayAutoApprove("high", [candidate])).toBe(true);
    expect(mayAutoApprove("medium", [candidate])).toBe(false);
    expect(mayAutoApprove("high", [candidate, { ...candidate, osmId: "node/2", distanceMeters: 15 }])).toBe(false);
  });

  it("parses private Maps activity timestamps as Taiwan account time", () => {
    expect(parseTakeoutCstTimestamp("2025年10月1日 上午9:30:00 CST").toISOString()).toBe("2025-10-01T01:30:00.000Z");
    expect(parseTakeoutCstTimestamp("2025年10月1日 下午9:30:00 CST").toISOString()).toBe("2025-10-01T13:30:00.000Z");
    expect(parseTakeoutCstTimestamp("2025年10月1日 凌晨12:30:00 CST").toISOString()).toBe("2025-09-30T16:30:00.000Z");
  });

  it("extracts only supported Maps activity evidence from Takeout HTML", () => {
    const html = `<body>
      <div class="outer-cell mdl-cell"><div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">Viewed <a href="https://www.google.com/maps/place/Test/data=!4m1!1sChIJTestPlace123">Test Museum</a><br>2025年10月1日 上午9:30:00 CST<br></div></div>
      <div class="outer-cell mdl-cell"><div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">Unrelated <a href="https://example.com">Private query</a><br>2025年10月1日 上午9:30:00 CST<br></div></div>
    </body>`;
    expect(parseMapActivityHtml(html)).toEqual([expect.objectContaining({
      action: "view",
      title: "Test Museum",
      googlePlaceIds: ["ChIJTestPlace123"],
      occurredAt: "2025-10-01T01:30:00.000Z",
    })]);
  });

  it("parses Directions activity when Google inserts an address before the timestamp", () => {
    const html = `<body>
      <div class="outer-cell mdl-cell"><div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">Directions to <a href="https://www.google.com/maps/dir/Test/@48.1372,11.5756,15z">Test Museum</a><br>Example address<br>Wed, 01 Oct 2025 01:30:00 GMT<br></div></div>
    </body>`;
    expect(parseMapActivityHtml(html)).toEqual([expect.objectContaining({
      action: "directions",
      title: "Test Museum",
      occurredAt: "2025-10-01T01:30:00.000Z",
    })]);
  });

  it("uses Maps viewport coordinates only as a City-filtering hint", () => {
    expect(extractMapsViewportCoordinate("https://www.google.com/maps/search/Test/@48.1372,11.5756,15z")).toEqual({
      latitude: 48.1372,
      longitude: 11.5756,
    });
    expect(extractMapsViewportCoordinate("https://www.google.com/maps/search/Test")).toBeNull();
    expect(extractMapsViewportCoordinate("https://www.google.com/maps/place/Test/data=!4m2!3d47.7138!4d11.7576"))
      .toEqual({ latitude: 47.7138, longitude: 11.7576 });
  });

  it("parses owner-confirmed manual POIs without retaining unrelated notes", () => {
    const rows = parseManualPoiSource(`Munich:\n* 國王廣場/Königsplatz: https://maps.app.goo.gl/example\n* Existing Place location update: https://maps.app.goo.gl/update\n* instruction only`);
    expect(rows).toEqual([
      expect.objectContaining({ cityName: "Munich", name: "Königsplatz", localizedName: "國王廣場", operation: "add" }),
      expect.objectContaining({ cityName: "Munich", name: "Existing Place", localizedName: null, operation: "location_update" }),
    ]);
  });

  it("extracts the official place coordinate from a resolved Google Maps URL", () => {
    expect(extractResolvedGoogleMapsLocation("https://www.google.com/maps/place/Test/@48.1,11.5,14z/data=!4m2!3d48.1372!4d11.5756!1sChIJTest"))
      .toEqual({ latitude: 48.1372, longitude: 11.5756, placeKey: "ChIJTest" });
  });

  it("uses an owner-confirmed coordinate keyed by stable Google Place identity", () => {
    const candidate = {
      googlePlaceId: "0x12cddb055c4fe4bd:0x1138a84037403971",
      latitude: 43.7031553,
      longitude: 7.2812612,
    };
    const corrected = applyGooglePlaceCoordinateOverride(candidate, new Map([[
      candidate.googlePlaceId,
      {
        google_place_id: candidate.googlePlaceId,
        city_id: "city-nice",
        name: "Marché Aux Fleurs - Cours Saleya - Nice",
        latitude: 43.6955865,
        longitude: 7.274994,
        source_status: "owner_confirmed_google_maps_link" as const,
      },
    ]]));
    expect(corrected).toEqual({
      ...candidate,
      latitude: 43.6955865,
      longitude: 7.274994,
    });
  });

  it("merges an owner-confirmed location update without changing the existing POI ID", () => {
    const existing = [{
      poi_id: "existing-id", city_id: "city-munich", name: "Existing Place", localized_name: null,
      original_name: "Existing Place", category: "Unclassified" as const, subcategory: "unclassified",
      latitude: 48, longitude: 11, review_status: "provisional_owner_assumption",
    }];
    const merged = mergeManualPoiReferences(existing, [{
      manual_id: "manual-id", city_id: "city-munich", name: "Existing Place", localized_name: "既有地點",
      latitude: 48.1, longitude: 11.1, operation: "location_update", source_status: "owner_confirmed_visit",
    }]);
    expect(merged).toEqual(expect.objectContaining({ added: 0, updated: 1, deduplicated: 0 }));
    expect(merged.pois[0]).toEqual(expect.objectContaining({
      poi_id: "existing-id", latitude: 48.1, longitude: 11.1, localized_name: "既有地點",
    }));
  });

  it("matches a location update through a hashed human-reviewed name alias", () => {
    const existing = [{
      poi_id: "reviewed-id", city_id: "city-salzburg", name: "Grocery store", localized_name: null,
      original_name: "Grocery store", category: "Unclassified" as const, subcategory: "unclassified",
      latitude: 47.8, longitude: 13.05, review_status: "provisional_owner_assumption",
    }, {
      poi_id: "unreviewed-duplicate", city_id: "city-salzburg", name: "Mega Star Kebab", localized_name: null,
      original_name: "Mega Star Kebab", category: "Unclassified" as const, subcategory: "unclassified",
      latitude: 47.8105, longitude: 13.0615, review_status: "provisional_owner_assumption",
    }];
    const manual = [{
      manual_id: "manual-id", city_id: "city-salzburg", name: "Mega Star Kebab", localized_name: null,
      latitude: 47.8105643, longitude: 13.0615841, operation: "location_update" as const,
      source_status: "owner_confirmed_visit" as const,
    }];
    const aliases = new Map([["reviewed-id", new Set([manualPoiNameHash("Mega Star Kebab")])]]);
    const merged = mergeManualPoiReferences(existing, manual, aliases);
    expect(merged).toEqual(expect.objectContaining({ added: 0, updated: 1, deduplicated: 1 }));
    expect(merged.pois).toEqual([expect.objectContaining({
      poi_id: "reviewed-id", name: "Mega Star Kebab",
      latitude: 47.8105643, longitude: 13.0615841,
    })]);
  });

  it("protects accepted Keep POIs while allowing discarded candidates to be removed", () => {
    const base = {
      city_id: "city-munich", localized_name: null, original_name: "Place",
      category: "Unclassified" as const, subcategory: "unclassified",
      longitude: 11.575, review_status: "provisional_owner_assumption",
    };
    const result = prunePublicPoiReferences([
      { ...base, poi_id: "retail", name: "dm-drogerie markt", latitude: 48.137 },
      { ...base, poi_id: "attraction", name: "Museum", category: "Attraction", latitude: 48.138 },
      { ...base, poi_id: "dense", name: "Nearby search", latitude: 48.13805 },
      { ...base, poi_id: "manual", name: "Owner place", subcategory: "owner_confirmed_visit", latitude: 48.13806 },
      { ...base, poi_id: "reviewed", name: "Reviewed place", latitude: 48.13807 },
      { ...base, poi_id: "reviewed-retail", name: "dm-drogerie reviewed", latitude: 48.13808 },
      { ...base, poi_id: "reviewed-discard", name: "Reviewed discard", latitude: 48.13809 },
    ], 15, new Set(["reviewed", "reviewed-retail"]));
    expect(result).toEqual(expect.objectContaining({ retailRemoved: 1, denseRemoved: 2 }));
    expect(result.pois.map(({ poi_id }) => poi_id).sort()).toEqual([
      "attraction", "manual", "reviewed", "reviewed-retail",
    ]);
  });

  it("keeps review dispositions disjoint in the generated POI dataset", async () => {
    const parsedRoot = resolve(import.meta.dirname, "..", "..", "data", "parsed");
    const [pois, reviewedIds, discardedIds, recheckIds] = await Promise.all([
      readFile(resolve(parsedRoot, "poi_reference.json"), "utf8").then(JSON.parse) as Promise<Array<{
        poi_id: string;
        review_status: string;
      }>>,
      readFile(resolve(parsedRoot, "poi_reviewed_ids.json"), "utf8").then(JSON.parse) as Promise<string[]>,
      readFile(resolve(parsedRoot, "poi_discarded_ids.json"), "utf8").then(JSON.parse) as Promise<string[]>,
      readFile(resolve(parsedRoot, "poi_coordinate_recheck_ids.json"), "utf8").then(JSON.parse) as Promise<string[]>,
    ]);
    const poiIds = new Set(pois.map(({ poi_id }) => poi_id));

    expect(reviewedIds.length).toBeGreaterThan(0);
    expect(discardedIds.length).toBeGreaterThan(0);
    expect(recheckIds.length).toBeGreaterThan(0);
    expect(reviewedIds.every((poiId) => poiIds.has(poiId))).toBe(true);
    expect(discardedIds.every((poiId) => !poiIds.has(poiId))).toBe(true);
    expect(recheckIds.every((poiId) => !poiIds.has(poiId))).toBe(true);
    expect(recheckIds.every((poiId) => pois.some((poi) => (
      poi.poi_id === `${poiId}-coordinate-review` && poi.review_status === "needs_review"
    )))).toBe(true);
  });

  it("exports the owner-confirmed Marché Aux Fleurs coordinate", async () => {
    const pois = JSON.parse(await readFile(
      resolve(import.meta.dirname, "..", "..", "data", "parsed", "poi_reference.json"),
      "utf8",
    )) as Array<{ name: string; latitude: number; longitude: number }>;
    expect(pois.find(({ name }) => name === "Marché Aux Fleurs - Cours Saleya - Nice"))
      .toEqual(expect.objectContaining({ latitude: 43.6955865, longitude: 7.274994 }));
  });

  it("matches attraction names against reviewed OSM aliases conservatively", () => {
    const feature = {
      name: "Musée du Louvre",
      tags: { "name:en": "Louvre Museum", alt_name: "The Louvre;Grand Louvre" },
    };
    expect(matchPoiName("Louvre Museum", feature)).toEqual({ score: 1, method: "alias_exact", matchedAlias: "Louvre Museum" });
    expect(matchPoiName("Louvre Museum tickets", feature)).toEqual(expect.objectContaining({ score: 0.96, method: "phrase_containment" }));
    expect(matchPoiName("Gallery Hotel SIS, Rostislavova 253/17, Praha", { name: "Hotel Praha", tags: {} })).toBeNull();
    expect(matchPoiName("Budapest, Historic Cats Museum, Magyar u. 5", { name: "Cats Museum", tags: {} }, "Budapest"))
      .toEqual(expect.objectContaining({ score: 0.92, method: "token_containment" }));
    expect(matchPoiName("museum", feature)).toBeNull();
  });

  it("collects only in-period Timeline path, raw GPS, and Visit evidence", () => {
    const evidence = collectTimelineEvidence({
      semanticSegments: [{
        startTime: "2025-10-01T10:00:00Z",
        timelinePath: [{ point: "48.0001°, 11.0001°", time: "2025-10-01T10:01:00Z" }],
        visit: { topCandidate: { placeLocation: { latLng: "48.0002°, 11.0002°" } } },
      }],
      rawSignals: [{ position: { LatLng: "48.0003°, 11.0003°", timestamp: "2025-10-01T10:02:00Z", accuracyMeters: 8 } }],
    });
    expect(evidence.map((point) => point.source)).toEqual(["semantic_visit", "timeline_path", "raw_position"]);
  });

  it("uses the Google display name and recovers a searched attraction when later Timeline evidence is nearby", () => {
    const cities: TravelCity[] = [{ id: "munich", name: "Munich", countryId: "germany", location: { latitude: 48.137, longitude: 11.575 } }];
    const feature = {
      osmId: "node/1",
      osmUrl: "https://www.openstreetmap.org/node/1",
      name: "Test Museum",
      category: "Attraction" as const,
      subcategory: "museum",
      latitude: 48.137,
      longitude: 11.575,
      tags: { tourism: "museum" },
    };
    const rows = recoverSearchedPois({
      activities: [{
        activityId: "activity-1",
        action: "search",
        title: "Test Museum",
        url: "https://www.google.com/maps/search/Test/@48.137,11.575,15z",
        occurredAt: "2025-10-01T09:00:00Z",
        googlePlaceIds: [],
      }],
      cities,
      snapshots: new Map([["munich", { features: [feature] }]]),
      evidence: [
        { latitude: 48.1371, longitude: 11.575, occurredAt: "2025-10-01T10:00:00Z", source: "timeline_path", accuracyMeters: null },
        { latitude: 48.1371, longitude: 11.5751, occurredAt: "2025-10-01T10:01:00Z", source: "raw_position", accuracyMeters: 8 },
        { latitude: 48.137, longitude: 11.5751, occurredAt: "2025-10-01T10:02:00Z", source: "semantic_visit", accuracyMeters: null },
      ],
      existingPois: [],
    });
    expect(rows).toEqual([expect.objectContaining({
      name: "Test Museum",
      category: "Attraction",
      proposedAction: "proposed_auto_approve",
      evidenceConfidence: "high",
      newCandidate: true,
      semanticVisitsWithin200Meters: 1,
    })]);
  });

  it("uses an exact citywide OSM name match when the Google Maps viewport is displaced", () => {
    const cities: TravelCity[] = [{
      id: "marseille", name: "Marseille", countryId: "france",
      location: { latitude: 43.302, longitude: 5.38 },
    }];
    const rows = recoverSearchedPois({
      activities: [{
        activityId: "activity-1", action: "directions", title: "Plage de Maldormé",
        url: "https://www.google.com/maps/dir/Test/@43.2935733,5.3755849,15z",
        occurredAt: "2026-03-01T10:00:00Z", googlePlaceIds: [],
      }],
      cities,
      snapshots: new Map([["marseille", { features: [{
        osmId: "way/97284416", osmUrl: "https://www.openstreetmap.org/way/97284416",
        name: "Plage de Maldormé", category: "Attraction", subcategory: "beach",
        latitude: 43.2804479, longitude: 5.350204, tags: { natural: "beach" },
      }] }]]),
      evidence: [{
        latitude: 43.2935733, longitude: 5.3755849,
        occurredAt: "2026-03-01T10:10:00Z", source: "timeline_path", accuracyMeters: null,
      }, {
        latitude: 43.2805, longitude: 5.3503,
        occurredAt: "2026-03-01T12:00:00Z", source: "timeline_path", accuracyMeters: null,
      }],
      existingPois: [],
    });
    expect(rows).toEqual([expect.objectContaining({
      name: "Plage de Maldormé",
      category: "Attraction",
      latitude: 43.2804479,
      longitude: 5.350204,
    })]);
  });

  it("accepts in-period proximity evidence even when movement preceded the search", () => {
    const cities: TravelCity[] = [{ id: "munich", name: "Munich", countryId: "germany", location: { latitude: 48.137, longitude: 11.575 } }];
    const rows = recoverSearchedPois({
      activities: [{
        activityId: "activity-1", action: "search", title: "Test Museum",
        url: "https://www.google.com/maps/search/Test/@48.137,11.575,15z",
        occurredAt: "2025-10-01T10:00:00Z", googlePlaceIds: [],
      }],
      cities,
      snapshots: new Map([["munich", { features: [{
        osmId: "node/1", osmUrl: "https://www.openstreetmap.org/node/1", name: "Test Museum",
        category: "Attraction", subcategory: "museum", latitude: 48.137, longitude: 11.575,
        tags: { tourism: "museum" },
      }] }]]),
      evidence: [{ latitude: 48.137, longitude: 11.575, occurredAt: "2025-10-01T09:00:00Z", source: "timeline_path", accuracyMeters: null }],
      existingPois: [],
    });
    expect(rows).toEqual([expect.objectContaining({
      name: "Test Museum",
      evidenceConfidence: "high",
    })]);
  });

  it("extracts the place name after a city prefix in a Maps display title", () => {
    expect(googleMapsDisplayName("Budapest, Historic Cats Museum, Magyar u. 5", "Budapest"))
      .toBe("Historic Cats Museum");
  });

  it("keeps a search-confirmed visit as Unclassified when OSM cannot classify it", () => {
    const cities: TravelCity[] = [{ id: "munich", name: "Munich", countryId: "germany", location: { latitude: 48.137, longitude: 11.575 } }];
    const rows = recoverSearchedPois({
      activities: [{
        activityId: "activity-1", action: "search", title: "Mystery Place, Munich",
        url: "https://www.google.com/maps/search/Mystery/@48.137,11.575,15z",
        occurredAt: "2025-10-01T10:00:00Z", googlePlaceIds: ["ChIJMystery"],
      }],
      cities,
      snapshots: new Map([["munich", { features: [] }]]),
      evidence: [{ latitude: 48.1371, longitude: 11.575, occurredAt: "2025-10-01T10:05:00Z", source: "timeline_path", accuracyMeters: null }],
      existingPois: [],
    });
    expect(rows).toEqual([expect.objectContaining({
      name: "Mystery Place",
      category: "Unclassified",
      googlePlaceId: "ChIJMystery",
      evidenceConfidence: "high",
      proposedAction: "proposed_auto_approve",
    })]);
  });

  it("accepts Search and Directions but not View, without a second-candidate uniqueness veto", () => {
    const cities: TravelCity[] = [{ id: "munich", name: "Munich", countryId: "germany", location: { latitude: 48.137, longitude: 11.575 } }];
    const features = [
      { osmId: "node/1", osmUrl: "https://www.openstreetmap.org/node/1", name: "Test Museum", category: "Attraction" as const, subcategory: "museum", latitude: 48.137, longitude: 11.575, tags: { tourism: "museum" } },
      { osmId: "node/2", osmUrl: "https://www.openstreetmap.org/node/2", name: "Test Museum Annex", category: "Attraction" as const, subcategory: "museum", latitude: 48.13705, longitude: 11.575, tags: { tourism: "museum" } },
    ];
    const base = { url: "https://www.google.com/maps/search/Test/@48.137,11.575,15z", occurredAt: "2025-10-01T10:00:00Z", googlePlaceIds: [] };
    const rows = recoverSearchedPois({
      activities: [
        { ...base, activityId: "search", action: "search", title: "Test Museum" },
        { ...base, activityId: "directions", action: "directions", title: "Directions to Test Museum" },
        { ...base, activityId: "view", action: "view", title: "Viewed Place" },
      ],
      cities,
      snapshots: new Map([["munich", { features }]]),
      evidence: [{ latitude: 48.137, longitude: 11.575, occurredAt: "2025-10-01T10:10:00Z", source: "semantic_visit", accuracyMeters: null }],
      existingPois: [],
    });
    expect(rows.every(({ mapsActivityTypes }) => !mapsActivityTypes.includes("view"))).toBe(true);
    expect(rows.find(({ name }) => name === "Test Museum")).toEqual(expect.objectContaining({
      category: "Attraction",
      proposedAction: "proposed_auto_approve",
    }));
    expect(rows.some(({ mapsActivityTypes }) => mapsActivityTypes.includes("directions"))).toBe(true);
  });

  it("uses private Maps activity only as supporting POI evidence", () => {
    const evidence = mapActivityEvidence(
      "ChIJTestPlace123",
      [{ name: "Test Museum" }, { name: "Other Museum" }],
      [{ rawStart: "2025-10-01T01:00:00Z", rawEnd: "2025-10-01T02:00:00Z" }],
      [{
        activityId: "activity-1",
        action: "view",
        title: "Test Museum",
        url: "https://www.google.com/maps/place/Test",
        occurredAt: "2025-10-01T01:30:00Z",
        googlePlaceIds: ["ChIJTestPlace123"],
      }],
    );
    expect(evidence).toEqual(expect.objectContaining({
      strength: "high",
      exactPlaceIdMatchCount: 1,
      candidateNameMatchCount: 1,
      matchedCandidate: 1,
      nearestActivityGapHours: 0,
    }));
    expect(mayAutoApprove("medium", [])).toBe(false);
  });

  it("treats a named search followed by a nearby Timeline Visit as strong attraction evidence", () => {
    const candidate = {
      osmId: "node/1",
      osmUrl: "https://www.openstreetmap.org/node/1",
      name: "Test Museum",
      category: "Attraction" as const,
      subcategory: "museum",
      latitude: 48,
      longitude: 11,
      tags: { tourism: "museum" },
      distanceMeters: 120,
    };
    const evidence = mapActivityEvidence(
      "timeline-place-id",
      [candidate],
      [{ rawStart: "2025-10-02T10:00:00Z", rawEnd: "2025-10-02T11:00:00Z" }],
      [{
        activityId: "activity-1",
        action: "search",
        title: "Test Museum",
        url: "https://www.google.com/maps/search/Test-Museum",
        occurredAt: "2025-10-01T10:00:00Z",
        googlePlaceIds: [],
      }],
    );
    expect(evidence).toEqual(expect.objectContaining({
      strength: "high",
      preVisitSearchMatchCount: 1,
      preVisitSearchCandidate: 1,
      preVisitNamedMatchCount: 1,
      preVisitNamedCandidate: 1,
    }));
    expect(mapActivityAutoApproval("high", [candidate], evidence)).toEqual({ candidate, selectedCandidate: 1 });
  });

  it("does not auto-approve an attraction from a search made only after the Visit", () => {
    const candidate = {
      osmId: "node/1",
      osmUrl: "https://www.openstreetmap.org/node/1",
      name: "Test Museum",
      category: "Attraction" as const,
      subcategory: "museum",
      latitude: 48,
      longitude: 11,
      tags: { tourism: "museum" },
      distanceMeters: 120,
    };
    const evidence = mapActivityEvidence(
      "timeline-place-id",
      [candidate],
      [{ rawStart: "2025-10-02T10:00:00Z", rawEnd: "2025-10-02T11:00:00Z" }],
      [{
        activityId: "activity-1",
        action: "search",
        title: "Test Museum",
        url: "https://www.google.com/maps/search/Test-Museum",
        occurredAt: "2025-10-03T10:00:00Z",
        googlePlaceIds: [],
      }],
    );
    expect(evidence.preVisitSearchMatchCount).toBe(0);
    expect(evidence.preVisitNamedMatchCount).toBe(0);
    expect(mapActivityAutoApproval("high", [candidate], evidence)).toBeUndefined();
  });
});
