# Data Relationship Inventory

This inventory identifies every relationship that must be created from the
current source data. It does not define a database schema. The current location
and alias reference tables have been owner-reviewed and may be used as
preprocessing rules.

## MVP Relationships

| Relationship | Cardinality | Current source | Construction rule | Review state |
| --- | --- | --- | --- | --- |
| Country contains City | one-to-many | `city_main_station.csv` | Use the reviewed `country` of each canonical City | Approved |
| Country contains Photo | one-to-many | Country image directory and `photo_manifest.csv` | Directory slug identifies Country | File relationships and chronological display order complete; alt text tentatively approved |
| Trip contains Segment | one-to-many, ordered | `segment-raw.csv` | Fill down Trip; preserve raw row order; generate stable Trip and Segment IDs | Rule confirmed |
| Segment has origin City | many-to-one | Segment origin plus `location_alias.csv` | Map every raw origin label to one canonical City | Approved |
| Segment has destination City | many-to-one | Segment destination plus `location_alias.csv` | Map every raw destination label to one canonical City | Approved |
| Segment has origin Country | many-to-one, derived | Origin City | Use the Country of the canonical origin City | Rule confirmed |
| Segment has destination Country | many-to-one, derived | Destination City | Use the Country of the canonical destination City | Needed for map endpoints; not used for Country expense attribution |
| Segment has ordered Transit Points | one-to-many, ordered | Comma-delimited Transit Point field | Split, trim, preserve text order, then resolve each label through `location_alias.csv` | Approved |
| Segment uses a transportation category | many-to-one | Raw transportation subtype | Map to one of the six confirmed categories while retaining the raw subtype | Rule confirmed |
| Segment has departure Airport Transfer | zero-or-one | Departure transfer price and second notes slot | Parse the departure position; create only when source semantics require a transfer record | Zero-value source semantics remain intentionally collapsed for MVP |
| Segment has arrival Airport Transfer | zero-or-one | Arrival transfer price and third notes slot | Parse the arrival position; create only when source semantics require a transfer record | Zero-value source semantics remain intentionally collapsed for MVP |
| Airport Transfer uses Airport | many-to-one | Airport endpoint label plus `airport_reference.csv` | Normalize raw airport labels to IATA code and reviewed airport reference | Approved |
| Airport Transfer uses City endpoint | many-to-one | Segment direction, canonical City, and City reference point | Use the reviewed reference point of the associated domain City | Approved |
| Accommodation belongs to Trip | many-to-one | Private Accommodation Trip field | Normalize or fill down Trip title and resolve it to generated Trip ID | Source Trip values currently align; transformed output still required |
| Accommodation belongs to City | many-to-one | Private Accommodation City field | Resolve the source City through the same canonical City vocabulary | Mapping output must exclude the exact address |
| Accommodation belongs to Country | many-to-one, derived | Accommodation City | Use the Country of the canonical Accommodation City | Rule confirmed |
| Transportation expense belongs to Segment | one-to-one value for MVP | Segment price | Store the normalized Segment transportation amount on its Segment | Standalone Expense records are not required for MVP |
| Airport-transfer expense belongs to Airport Transfer | one-to-one value for MVP | Departure or arrival transfer price | Store the normalized amount on the parsed transfer | Standalone Expense records are not required for MVP |
| Accommodation expense belongs to Accommodation | one-to-one value for MVP | Accommodation price | Store the normalized amount on the sanitized Accommodation output | Standalone Expense records are not required for MVP |
| Country transportation aggregation contains Segment | one-to-many, derived | Segment origin Country | Attribute each Segment to its origin Country only | Rule confirmed |
| Country accommodation aggregation contains Accommodation | one-to-many, derived | Accommodation City Country | Attribute each Accommodation to its normalized City Country | Rule confirmed |
| Map path uses reference point | many-to-one | City, airport, and geocoding reference tables | Use only reviewed latitude and longitude values | Approved |

## Domain Relationships Not Materialized for MVP

| Relationship | Reason for postponement | Required later input or rule |
| --- | --- | --- |
| Trip contains Visit | Visit is a backend concept but is not required by the current map or expense UI | Visit inference logic and stable Visit IDs |
| Visit belongs to City | Same as above | Canonical City plus visit-boundary inference |
| Visit contains Accommodation | Trip plus City is sufficient for MVP | Check-in/out dates where repeated stays are ambiguous |
| Visit contains or borders Segment | No MVP consumer requires this link | Precise arrival/departure semantics |
| City contains POI | POI reconstruction is MVP+ | Reviewed POI dataset or Timeline-derived candidates |
| POI contains Photo | POI is MVP+ | Reviewed POI identities and photo-to-POI assignments |
| Photo belongs to City or POI | Country photos work at Country level in MVP; candidate City is only advisory | Owner review of `candidate_city`; POI assignments later |
| Segment or accommodation references standalone Expense | Current metrics need values, not an independent ledger | Promote only if expense identity, refunds, splitting, or reconciliation enters scope |

## Review Tables

* `data/parsed/location_alias.csv` covers every distinct origin, destination,
  and Transit Point spelling in the current Segment source.
* `data/parsed/city_main_station.csv` records reviewed City reference points.
* `data/parsed/city_reference_geocoding.csv` holds coordinate candidates for
  those reference points.
* `data/parsed/airport_reference.csv` links every current airport spelling to an
  IATA code, airport candidate, and associated domain City.
* `data/parsed/country_reference.csv` records Country map candidates and the
  current microstate flag.
* `data/parsed/photo_manifest.csv` links application-ready images to Countries
  and proposes display order, City, and alternative text.

## Confirmed Vatican City Special Case

Vatican City is an approved MVP Country and microstate in
`country_reference.csv`. Its model is:

* Vatican City is a Country;
* Vatican City is also its canonical City for navigation and aggregation;
* individual sites such as the Vatican Museums or St. Peter's Basilica are
  POIs within that City when POIs enter scope;
* the Country may have photos even when it has no Segment, Accommodation, or
  Expense records; missing travel metrics must not be presented as zero.

This keeps sovereign geography separate from attraction-level POIs and avoids
making a POI stand in for a visited Country.
