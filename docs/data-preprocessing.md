# Data Preprocessing Decisions

This document records confirmed source-data conventions and preprocessing
rules. Tabular raw files remain unchanged by preprocessing.

## Segment Source Conventions

* A non-empty `Trip` cell starts a Trip group. Blank `Trip` cells inherit the
  preceding non-empty Trip value through fill-down.
* Raw row order is the Segment time order.
* Preprocessing generates a stable Trip ID and a stable Segment ID/sequence.
  Human-readable Trip titles are not required to serve as immutable IDs.
* Raw endpoint labels are mapped to canonical Cities. Station, coach-station,
  airport, abbreviation, punctuation, and whitespace variants remain source
  evidence rather than separate Cities.
* `M.` means Munich in `M. Hbf.` and `M. ZOB.`.
* Dates are parsed into an application date type and serialized as ISO
  `YYYY-MM-DD` values.
* Text values are trimmed and normalized before controlled-vocabulary mapping.

## Transportation Categories

| Raw subtype | Analysis category |
| --- | --- |
| 高鐵 | High-speed Rail |
| 火車 | Train |
| 公車 | City Bus |
| 客運 | InterCity Bus |
| 飛機 | Plane |
| 郵輪 | Ferry / Cruise |

The six analysis categories control map styling, filtering, Segment-level
aggregation, and Country-level aggregation. The raw subtype remains visible in
Segment metadata.

| Analysis category | Color |
| --- | --- |
| High-speed Rail | deep red (`#780d25`) |
| Train | dark pink (`#c65c82`) |
| City Bus | light green (`#a2d9b0`) |
| InterCity Bus | green (`#34855b`) |
| Plane | dark blue (`#254e85`) |
| Ferry / Cruise | light blue (`#8bc8e5`) |

## Endpoint Transfer Parsing

The raw Segment notes field has three slash-delimited positions:

1. Segment notes
2. departure Endpoint Transfer notes
3. arrival Endpoint Transfer notes

Empty positions are meaningful and must be retained while parsing. Transfer
notes may contain the mode and company and are displayed verbatim in metadata.

The airport endpoint comes from the source Segment endpoint. The city endpoint
uses the reviewed City reference point, normally its main railway station.
Transfer dates and distances are not manually added to the raw data for MVP.
Any distance required for analysis is derived from reviewed coordinates.

Raw transfer cost `0` represents no transfer, a free transfer, or a transfer
whose price is included elsewhere. The MVP intentionally does not distinguish
these cases.

The current source also contains four non-airport endpoint transfers: the two
ends of the Marseille → Barcelona ferry, the Barcelona departure for the
Barcelona → Naples ferry, and the Utrecht arrival from Munich. Preprocessing
preserves these records with `endpointKind: local`. Their cost and straight-line
distance are always included in the parent Segment's transportation metrics;
they are not controlled by the Airport Transfer checkbox and do not become
independent Segments or transportation-category aggregation units.

`data/parsed/local_transfer_reference.csv` stores the four owner-approved route
endpoint pairs. They use Marseille-Saint-Charles → Marseille Provence Cruise
Terminal, Terminal D Palacruceros ↔ Barcelona Nord, and Utrecht Leidsche Rijn →
Utrecht Centraal. The Barcelona terminal is Terminal D because the source
Segment operator is Costa and the terminal is the Costa-associated
Palacruceros facility. Preprocessing derives each distance from the two reviewed
GPS points rather than storing a manually calculated distance.

Confirmed airport-to-domain-City mappings include:

* `FMM` → Munich
* `TRF` → Oslo
* `BGY` Airport overnight → Milan
* `HHN` → Koblenz, based on the last City before the airport in its Trip
* `ASR` → Göreme; the airport candidate is the confirmed Kayseri Airport

## Transit Point Parsing

* Comma-separated Transit Points retain their source order.
* Every listed Transit Point represents an actual visit.
* Pure transfer-only locations are excluded from visual analysis.
* A Transit Point has no separate transportation or accommodation expense. If
  it does, the source movement is represented as multiple Segments.
* All Segments sum haversine distances over their ordered origin, Transit Points,
  and destination. Without Transit Points, use the direct endpoint distance.
  This also gives same-origin-and-destination Segments a non-zero route when
  ordered Transit Points exist.
* Skopje (SKP overnight, 2026-01-20 TRF to FMM) is a formal Transit Point. The
  raw Transit Point cell and approved location alias record represent it
  explicitly; notes alone are not automatically parsed into visits. This airport
  overnight is an exception to the no-separate-accommodation convention above.
* A Transit Point more than 35 km from the reviewed center-point station of the
  canonical City to which that Transit Point belongs may receive a navigable
  City Map in MVP+.

## City Map POI Preprocessing

`data/raw/timeline.json` is the private local source for City Map POI
candidates and is excluded from Git. Only Visits during the 2025-09-30 through
2026-03-31 review period are processed.
`data/raw/POIadd_until_Munich_v1.txt` is a second gitignored owner-confirmed
source. Its Google Maps short links are resolved only during preprocessing;
tracked output retains the reviewed names, City relationship, stable opaque ID,
and coordinates but not the source short link. These records establish that the
place was visited, while category and display-name review still occurs in the
temporary POI review tool. Entries marked `location update` update a matching
City/name record without replacing its existing POI ID; unmatched entries
become new `Unclassified` review candidates.
When a location-update name was introduced by human review rather than the raw
candidate, preprocessing matches it through a tracked SHA-256 hash of the
normalized reviewed name. The plaintext review export remains local, while the
matched candidate keeps its reviewed POI ID and receives the manual name and
coordinates instead of creating a duplicate manual POI. If an unreviewed
same-name candidate is within 250 metres of that authoritative manual location,
it is collapsed into the reviewed ID; another reviewed POI is never removed.
POIs may only be related to an existing Travel Map City or City-like Location.
Candidates whose City relationship is ambiguous remain in the preprocessing
dataset but do not enter application-ready City Map data.

Repeated Visits with the same Google Place ID are merged into one POI. Each
source Visit retains a deterministic ID derived from Place ID, start time, end
time, and hierarchy level. Raw timestamps are preserved, and local timestamps
are derived from the candidate City's reviewed country time zone; the `+08:00`
offset present in Timeline data must not be treated as European local time.

POI names and classification candidates come from an OpenStreetMap snapshot
downloaded by City area and matched to Timeline coordinates locally. Individual
Timeline coordinates are not sent to an external reverse-geocoding service, and
Google Places API content is not used to build application data. Up to three OSM
candidates are retained with distance, element ID, tags, map link, matching
method, and confidence. A Google Place ID review link may be retained for manual
comparison.

`data/raw/map_search.html` is optional private supporting evidence from the
owner's Google Maps activity export. It is gitignored and processed locally;
the raw file, unrelated searches, account metadata, and unmatched activity
titles must not enter the review workbook or public application data. Search,
View, and Directions activity within the review period may support an existing
Timeline POI candidate. The search-confirmed POI flow below accepts only Search
and Directions; a View alone never creates a POI.
The export's `CST` timestamps are interpreted as the owner's Taiwan account
time and compared with the raw UTC Visit interval. Exact Google Place ID and
exact normalized OSM candidate-name matches are retained as aggregate evidence
counts, action types, nearest time gap, and the best matched name/candidate.
Searching, viewing, or requesting directions without corresponding Timeline
evidence must not create a POI. For an existing Timeline POI candidate, exact
Place ID and normalized OSM-name matches remain supporting evidence under the
current matching rules.

The search-confirmed POI flow starts from each in-period Search or Directions
record. Its Google Maps displayed place name becomes the primary display-name
candidate. The coordinate encoded in the Maps URL is treated as an approximate
search viewport, not a verified official Place coordinate. When any in-period
Timeline path point, raw GPS position, or semantic Visit falls within 350 metres
of that viewport, regardless of whether the movement precedes or follows the
Maps activity, the searched place is classified as High-confidence visit
evidence and proposed for automatic inclusion. The retained nearest time gap is
an absolute difference. A View alone, a search without a viewport, a City-only
query, or a search without in-period proximity evidence does not create a POI.

Nearby named OSM features within 350 metres are used only to classify and enrich
the search-confirmed POI. A reliable name match to an OSM Attraction classifies
the result as `Attraction` and supplies the OSM coordinate; otherwise the result
is retained as `Unclassified` at the approximate search viewport. Competing
nearby OSM candidates do not veto this search-confirmed visit: the general rule
requiring a second candidate to be at least 50 metres away or twice as far does
not apply to this flow. The workbook contains only the selected Google display
name, optional matched OSM metadata, and aggregate distance/count evidence; raw
activity rows, exact private trajectories, and unmatched searches remain local
and are not exported.

When the owner supplies a Google Maps link for a coordinate correction, the
resolved canonical Place coordinate may be stored in
`data/parsed/poi_google_place_coordinate_overrides.json`, keyed by the stable
Google Place identity already present in the private activity export. The
tracked override contains only the identity, reviewed City/name, coordinate,
and source status; it does not retain the short link or unrelated activity.
This coordinate replaces the approximate viewport for an unreviewed candidate.
An accepted reviewed `Keep` snapshot and coordinate lock still take precedence,
while a reviewed `Discard` remains excluded. When the owner explicitly identifies
an override as the corrected location of an accepted reviewed POI, the override
may name that reviewed POI as its target. The pipeline then preserves the
reviewed POI ID and edited metadata, applies the canonical coordinate after the
coordinate lock, and removes the matching provisional Google Place duplicate.

The private unreviewed-coordinate audit scans the current review candidates
against a locally indexed set of OSM aliases in the assigned City. It excludes
accepted `Keep` records, already reopened `needs_review` records,
owner-confirmed manual additions, and candidates already using an OSM source
coordinate. Findings require a distance of at least 250 metres. A unique
`exact` or `alias_exact` name is ranked High, a unique match scoring at least
0.92 is ranked Medium, and competing or weaker matches are Ambiguous. These
levels describe confidence in the OSM name candidate, not proof that the
current coordinate is wrong. The audit is report-only and remains private;
only an owner-confirmed canonical Place link or another approved source may
create a coordinate override. Its output also records every assigned City that
could not be audited because no OSM snapshot was available. Missing coverage is
not equivalent to a clean result and must remain visible until a later rerun
successfully creates the City snapshot.

An OSM `exact` or `alias_exact` name match within the already assigned City is
an exception to the 350-metre classification radius because a Google Maps URL
may encode a displaced search viewport rather than the Place coordinate. The
exact OSM feature supplies the POI coordinate; fuzzy or partial matches remain
subject to the 350-metre limit. A citywide exact match is normally applied only
when the Timeline evidence also contains a point within 350 metres of that OSM
feature. One conservative exception is allowed when the search record has a
stable Google Place identity, the City has exactly one exact or alias-exact OSM
name candidate, and that candidate is an `Attraction` or `Station`. This rule
may replace a displaced viewport with the OSM coordinate. It does not apply to
restaurants, takeaways, shops, or supermarkets because same-name branches are
common. Station candidates retain their Google recovery ID and remain hidden
under the current display-category policy; coordinate correction must not cause
review-identity churn.

Before this rule or another preprocessing improvement can change tracked POI
coordinates, imported human-reviewed POIs receive coordinate locks from the
last reviewed dataset, and full reviewed snapshots preserve their IDs and
candidate records across reclassification. A separate private audit accepts the
local review export and reports only unique exact-name OSM matches whose
coordinates differ by at least 250 metres. The audit does not overwrite POI
coordinates. A reviewed `Keep` finding is instead re-keyed as a new
`needs_review` candidate so that the owner can compare and approve the corrected
location explicitly; its previous review remains local audit history. A
reviewed `Discard` remains excluded. Explicit owner-provided `location update`
entries may still override a coordinate lock.

Candidate records carry `match_confidence`, `category_confidence`,
`city_confidence`, `overall_confidence`, and `review_priority`. A POI may be
`auto_approved` only when its Timeline coordinate is inside a unique compatible
named OSM polygon, or when exactly one compatible named OSM POI is within 25
metres and the next candidate is clearly farther away, and both classification
and City assignment are unambiguous. Other review states are `needs_review`,
`owner_approved`, `excluded`, and `unresolved`. Owner review may override an
automatic decision.

The review workbook contains `POI Review`, `Searched POI Recovery`, `Visits`,
`Category Mapping`, and `Review Summary`. `Searched POI Recovery` is an isolated
sheet whose yellow decision and notes columns are available for owner
review; it does not mutate `POI Review`. Preprocessing regenerates all evidence
sheets without VBA macros. The review sheets support coarse-grained
High, Medium, and Low confidence plus filtering or sorting by review priority,
review status, City, and category. Import validation requires unique POI IDs,
valid City references and categories, and coordinates for displayed POIs.
`needs_review` and `unresolved` records cannot enter final application-ready
data. The temporary POI QA branch may expose `needs_review` candidates in its
City Map review dataset, but they remain ineligible for the final cleaned
dataset until reviewed. For the current visual review, the owner has directed the pipeline to
provisionally treat every search-confirmed High-confidence POI as correct. The
public export labels these rows `provisional_owner_assumption` so
that this temporary assumption remains distinguishable from completed review.

Preprocessing retains Attraction, Station, Restaurant, Shop, Shopping Mall,
Takeaway, Supermarket, Convenience Store, and other identifiable categories.
The current City Map visual-review release includes provisionally accepted
`Attraction` and search-confirmed `Unclassified` records, with independent map
filters and distinct marker encodings. Restaurant is the next display category;
Stations and all other categories are processed but hidden by default. The
export deduplicates OSM Attractions by OSM element ID and search-confirmed POIs
by Google Place ID when available, otherwise by normalized Google display name
within the City. Ordinary retail candidates—including supermarkets,
convenience stores, shopping malls, pharmacies/drugstores, and other named
shops—are excluded from the visual-review list. After this semantic filter,
`Unclassified` candidates no more than 15 metres from an already retained POI
in the same City are treated as dense duplicates; explicit Attractions and
unmatched owner-confirmed manual additions, and accepted human-reviewed `Keep`
records are never removed by this spatial rule. A reviewed `Keep` record with a
coordinate-audit discrepancy is reopened under a new candidate ID and enters
the pending review list. Reviewed `Discard` records are excluded from both the
application-ready data and the visual-review candidate dataset; the original
local review result remains unchanged as audit history.
Before writing tracked public data, the export removes search, Timeline, Visit,
matching, confidence, and review evidence. Display
names use OSM `name:en` as the main English field when available and otherwise
retain the reviewed source or Google Maps displayed name. OSM `name:zh-Hant`,
then `name:zh`, is retained as a separate optional localized field. The pipeline
does not invent translations or duplicate an identical value as a second
language. The parsed reference retains the original source name for traceability,
while the public application dataset exposes only the main name and optional
Chinese display name.
POI images are optional; their
folder, naming, conversion, and relationship workflow remain deferred until POI
review is complete.

The temporary in-map POI review tool stores a separate, versioned review result
in browser localStorage and supports JSON export and import. POI ID is the
upsert key. Each record contains the edited English/primary display name, an
optional edited Chinese display name, Keep or Discard
decision, selected public categories, review status, and update timestamp. The
browser must never rewrite `poi_reference.json`, the review workbook, Timeline,
Maps activity, or any other raw/private input. After owner review, preprocessing
will validate and merge `Raw/Recovered POI + Owner-confirmed Manual POI + Review
Result` into cleaned application-ready POI data. The temporary UI may then be
removed while its exported review result remains an auditable transformation
input.
The versioned parser accepts legacy single-name review records and migrates the
missing Chinese name to `null`; new exports always use the bilingual schema.

Temporary review links always build the Google Maps query from the already-public
POI latitude and longitude. No link-mode field, raw search text, activity
timestamp, source URL, or unmatched activity enters application data.

`npm run data:city-context` sends only the public City name and Country name for
every Travel Map City to Nominatim. It caches the response locally and writes
the selected, simplified OSM Polygon or MultiPolygon to
`data/parsed/city_map_context.json`. Timeline positions, Maps activity, POI
coordinates, and other private evidence are never included in this request.
Andorra uses the explicit `Andorra la Vella` query, while Vatican City uses its
reviewed country/city boundary relation. When a City-like Location has no OSM
administrative boundary, preprocessing writes a five-kilometre local extent
around its reviewed City reference point and labels it as such rather than
claiming it is an administrative boundary. The application dataset removes the
source label and OSM identifier, retaining City ID, context kind, attribution
source, and boundary geometry. Dataset validation requires exactly one context
for every Travel Map City. City Map zoom uses the polygon containing the reviewed City
reference point (or the largest polygon as fallback), so detached administrative
enclaves do not make central POIs unreadably small.

## Accommodation Source Conventions

* Blank Trip cells are filled down.
* Accommodation City values are trimmed; source `Krakow` maps to canonical
  `Kraków`, and trailing whitespace such as `Milan ` is removed.
* Prices and commute durations are converted from unit-bearing text to typed
  numeric values.
* Accommodation types are Airbnb, Hostel, Hotel, and Airport. Hostel remains an
  independent category.
* Airport commute values recorded as `0` become not-applicable and are excluded
  from commute calculations.
* Airport identity is taken from the accommodation name or notes.
* No separate handling-fee, tax, refund, or cost-sharing adjustment is modeled
  for MVP.
* Check-in and check-out dates are not required for MVP.
* Trip plus canonical accommodation City is sufficient for MVP aggregation.
  Exact Visit assignment is deferred unless repeated stays become ambiguous.
* The scoring components and total are validated against
  `data/raw/accommodation_rubic.md`; preprocessing must not silently correct a
  malformed or inconsistent score.
* Nearest-station enrichment is a separate, local review step using the private
  address. `scripts/review-accommodation-stations.mjs` queries Photon with a
  1.5-second minimum request interval and caches results under
  `data/private/station-lookup/`. `scripts/summarize-accommodation-stations.mjs`
  produces the local review table. Neither command runs in CI or the browser.
* Station lookup candidates use approximate straight-line distances, not the
  existing main-station commute duration. Street and complete house-number
  matches are required; unresolved addresses remain unresolved. Review must
  confirm the geocoded building, station type, and accessibility before any
  candidate becomes public metadata. Query limits and incomplete map coverage
  mean the returned candidate is not guaranteed to be the absolute nearest stop.
  Airport overnight retains its airport identity instead of a street-address lookup.
* After owner review, the public station name is copied by Accommodation ID to
  `data/parsed/accommodation_station_reference.json`. The reference must exactly
  cover every Accommodation: non-Airport stays have a non-empty station name,
  while Airport overnight stays use `null`. No private address, geocoder match,
  distance, or station candidate history enters the public dataset.

## Privacy Boundary

The repository is public. Private raw information must not be committed or
pushed; tracked Accommodation data must be deliberately sanitized.

Exact accommodation addresses are private source data. The complete source file
is stored at `data/private/accommodation-raw.csv`, which is excluded from Git.
It must not be emitted to public application data. Public output contains only
the reviewed City and, when explicitly approved, a coarse public location label.

The preprocessing pipeline must treat the private source as a local input and
must never copy exact addresses into tracked files, build artifacts, logs, test
fixtures, or application metadata.

The application-ready Accommodation record deliberately uses a generic label
such as `Hostel in Salzburg`; the private source name is excluded together with
the exact address.

## Application-ready Dataset

Run `npm run data:build` locally to combine the tracked Segment and reviewed
reference files with the ignored private Accommodation CSV. The command writes
`public/data/travel-data.json`, validates its runtime schema and relationships,
checks every photo asset, and rejects private Accommodation fields in the
serialized output. It also imports the tracked, privacy-reduced
`data/parsed/poi_reference.json` and emits only the public POI ID, City
relationship, main display name, optional Chinese display name, category, subcategory, coordinates, and optional
image path. Source IDs, URLs, Visits, search evidence, confidence, and review
status do not enter the browser dataset.

CI runs `npm run data:validate` against the committed output without access to
the private source. The browser consumes only this JSON and never parses source
CSVs or calls a geocoder.

## Country Image Preparation

The MVP contains 20 Countries, each with exactly three landscape source photos
under `data/raw/img/<country>/`. These 60 high-resolution JPEG sources are local
inputs and are excluded from Git.

Before web-image generation, source photos are converted from Samsung Motion
Photos to single-frame JPEGs and stripped of EXIF, GPS, device, and Motion Photo
metadata. Recoverable original Motion Photos remain under the ignored
`data/private/` boundary.

Application-ready images are written to
`public/images/countries/<country>/<descriptive-name>.webp` with these rules:

* preserve the source aspect ratio;
* resize to a maximum width of 1,920 pixels without upscaling;
* encode as WebP at quality 82 with metadata excluded;
* use lowercase kebab-case Country directories and descriptive file names;
* retain exactly three images for every MVP Country.

`data/parsed/photo_manifest.csv` inventories the current application assets.
`display_order` follows capture chronology within each Country, reconstructed
from private source timestamps without exposing those timestamps publicly. The
current alternative text is tentatively owner-approved and remains unchanged.
`candidate_city` is advisory relationship-review data rather than an MVP display
requirement. Andorra photos intentionally have no City relationship.

## Reviewable Reference Data

Preprocessing must consume reviewed reference data rather than embedding
one-off location guesses in application code:

* `city_main_station.csv` defines the selected reference point for every
  canonical City. Bad Camberg uses the owner-confirmed `Bad Camberg Bf.`.
  Königssee is an explicit exception and uses
  `Tourist-Information am Parkplatz Königssee` instead of a railway station.
  Other selected reference points are London Waterloo, Paris Gare du Nord,
  Dublin Connolly, Istanbul Sirkeci Garı, and Brussels-Midi/Brussel-Zuid.
* `location_alias.csv` provides an explicit mapping for every distinct Segment
  origin, destination, and Transit Point label currently present in raw data.
* `city_reference_geocoding.csv`, `airport_reference.csv`, and
  `country_reference.csv` preserve the external geocoding candidates and their
  approval state. Only rows whose review status is `approved` may be used as
  authoritative preprocessing input.

The one-time candidate lookup is designed for OpenStreetMap Nominatim. It must
be single-threaded, remain at or below one request per second, identify the
application with a custom User-Agent, and cache responses. The public API is a
data-preparation dependency only and must not be called by the website at
runtime.

The dataset contains approved coordinates for all 84 City reference points,
28 Airports, and 20 MVP Country records. Country markers normally use
each Country's capital-City coordinate. Italy is an owner-approved display
exception: its Country marker uses the reviewed Milano Centrale reference
point to separate it from Vatican City, while Rome remains Italy's capital.
