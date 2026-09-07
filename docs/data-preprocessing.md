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
| High-speed Rail | red |
| Train | pink |
| City Bus | light green |
| InterCity Bus | green |
| Plane | dark blue |
| Ferry / Cruise | light blue |

## Airport Transfer Parsing

The raw Segment notes field has three slash-delimited positions:

1. Segment notes
2. departure Airport Transfer notes
3. arrival Airport Transfer notes

Empty positions are meaningful and must be retained while parsing. Transfer
notes may contain the mode and company and are displayed verbatim in metadata.

The airport endpoint comes from the source Segment endpoint. The city endpoint
uses the reviewed City reference point, normally its main railway station.
Transfer dates and distances are not manually added to the raw data for MVP.
Any distance required for analysis is derived from reviewed coordinates.

Raw transfer cost `0` represents no transfer, a free transfer, or a transfer
whose price is included elsewhere. The MVP intentionally does not distinguish
these cases.

Confirmed airport-to-domain-City mappings include:

* `FMM` → Munich
* `TRF` → Oslo
* `BGY` Airport overnight → Milan

## Transit Point Parsing

* Comma-separated Transit Points retain their source order.
* Every listed Transit Point represents an actual visit.
* Pure transfer-only locations are excluded from visual analysis.
* A Transit Point has no separate transportation or accommodation expense. If
  it does, the source movement is represented as multiple Segments.
* A same-origin-and-destination Segment uses its ordered Transit Points to
  construct a non-zero route.
* A Transit Point more than 35 km from the reviewed center-point station of the
  canonical City to which that Transit Point belongs may receive a navigable
  City Map in MVP+.

## Accommodation Source Conventions

* Blank Trip cells are filled down.
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

## Privacy Boundary

Exact accommodation addresses are private source data. The complete source file
is stored at `data/private/accommodation-raw.csv`, which is excluded from Git.
It must not be emitted to public application data. Public output contains only
the reviewed City and, when explicitly approved, a coarse public location label.

The preprocessing pipeline must treat the private source as a local input and
must never copy exact addresses into tracked files, build artifacts, logs, test
fixtures, or application metadata.

## Country Image Preparation

The 19 MVP Countries each have exactly three landscape source photos under
`data/raw/img/<country>/`. These high-resolution JPEG sources are local inputs
and are excluded from Git.

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

## Resolved Data Review Items

The owner has corrected the previously identified missing Accommodation types,
missing Accommodation Cities, rating format and total differences, City
spelling errors, Transit Point spelling error, and the duplicated Segment
destination in the Strasbourg → Karlsruhe Transit Point list.

The City reference-point list has been manually reviewed. The selected special
reference points are London Waterloo, Paris Gare du Nord, Dublin Connolly,
Istanbul Sirkeci Garı, and Brussels-Midi/Brussel-Zuid.

`City Map` in this rule means the navigable MVP+ City Map.

## Public Repository Rule

The repository is public. New exact accommodation addresses or other private
raw information must not be committed or pushed. The complete Accommodation
source is stored under the ignored `data/private/` directory. Any tracked
Accommodation dataset must be a deliberately sanitized, application-ready
output that excludes exact addresses and other private fields.
