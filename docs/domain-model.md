# Project — Domain Model

## Entities

### Country

A country visited during the exchange period.

Examples:

* France
* Germany
* Italy
* Vatican City

A visited Country may exist without a Segment. Country inclusion is based on
reviewed visit evidence, not on whether the transportation graph reaches it.
Vatican City is an MVP example: it has a Country marker and Photos but no
Rome-to-Vatican Segment.

---

### City

A city actually visited during the exchange period.

Examples:

* Paris
* Munich
* Barcelona

A City may be visited multiple times across different Trips.

Raw Segment endpoints may contain a city name, railway station, coach station,
airport abbreviation, or another location label. These source labels are not
City identities. Data preprocessing maps them to a canonical City before the
data is used by the application. For example, `M. Hbf.` and `M. ZOB.` both use
`M.` to mean Munich.

A City has a reference point used for distance calculations. This is normally
the main railway station, but a reviewed fallback reference point is required
for cities that have no single main station or no railway station.

Königssee is an owner-approved City-like Location exception for MVP. It uses
`Tourist-Information am Parkplatz Königssee` as its reference point even though
it is not modeled as a conventional municipality.

---

### Trip

A logical travel journey.

For the current dataset, a Trip is primarily represented by its Segments.

A Trip normally starts and ends at the exchange base city.

A Trip may contain multiple Segments.

Trip is a backend/domain concept and does not necessarily correspond directly to a visible UI element in MVP.

In the raw CSV, the Trip value is written on the first Segment row and inherited
by subsequent blank rows through fill-down. Raw row order is the authoritative
Segment time order. Preprocessing may generate stable Trip and Segment IDs, but
the Trip title remains the user-facing name.

---

### Visit

A continuous stay/visit associated with a City within a Trip.

Visit is primarily a backend/domain concept.

Users do not directly see the Visit distinction in the MVP.

A City may have multiple Visits across different Trips.

A Trip must contain at least one Visit under the normal long-distance travel model.

---

### Segment

A major transportation movement within a Trip.

Examples:

* Munich → Paris
* Paris → Milan
* Milan → Munich

A Segment has:

* origin
* destination
* date
* transportation mode
* transportation cost
* transportation company
* notes
* optional Endpoint Transfers
* an exact transportation subtype
* a normalized transportation category

A Segment is the primary unit for travel-path visualization and transportation expense analysis.

All Segments currently present in the source data are included in the MVP map.

---

### Endpoint Transfer

Transportation between a Segment endpoint and the terminal or station used by
the primary Segment movement. An Endpoint Transfer belongs to a parent Segment
and is not itself a Segment.

Endpoint Transfers have a departure or arrival side, price, notes, distance,
and reviewed route endpoints. They inherit the parent Segment's transportation
category and Country attribution rather than becoming independent aggregation
units.

A paid local Endpoint Transfer, such as a railway-station-to-cruise-terminal
movement, is always included in its parent Segment's transportation expense and
distance. A zero-cost Endpoint Transfer contributes neither cost nor distance.

### Airport Transfer

Transportation between a city and an airport.

Examples:

* Milan → BGY
* BGY → Milan
* STN → London

Airport Transfer is an Endpoint Transfer subtype and is NOT a Segment.

It may be associated with a Segment and may optionally be included in transportation expense analysis.

Airport Transfers may have:

* price
* transportation company
* notes
* distance

The city endpoint of an Airport Transfer uses the City's reviewed reference
point. The airport endpoint is identified by the airport label in the Segment
source data.

---

### Accommodation

A place where the user stayed during a Visit.

Examples:

* Airbnb
* Hotel
* Hostel
* Airport overnight stay

A Visit may contain multiple Accommodations.

Accommodation may have:

* price
* number of nights
* commute time to main railway station
* rating
* type
* notes

---

### POI

A place visited within a City.

Examples:

* Eiffel Tower
* Vatican Museums
* St. Peter's Basilica
* museums
* attractions

POIs are primarily MVP+.

---

### Photo

A travel photo or photo group.

Photos may be associated with:

* Country
* City
* POI

City-level photos should be representative rather than showing every available photo.

---

### Expense

A monetary expense.

Examples:

* transportation cost
* accommodation cost
* airport transfer cost

Expense is currently primarily used as supporting data for analysis rather than as a standalone user-facing domain object.

---

## Relationships

### Country

* Country contains City
* Country may contain Segment
* Country contains Photo

### City

* City belongs to Country
* City contains Segment
* City contains Accommodation
* City contains POI
* City contains Photo

### Trip

* Trip contains Visit
* Trip contains Segment

Trip's country/city participation can be derived from its Visits and Segments.

### Visit

* Visit belongs to Trip
* Visit belongs to City
* Visit may contain Segment
* Visit may contain Accommodation

### Segment

* Segment belongs to Trip
* Segment belongs to/from City
* Segment belongs to/from Country
* Segment may contain Endpoint Transfer
* Segment may reference Expense

### Endpoint Transfer

* Endpoint Transfer belongs to Segment
* Endpoint Transfer may reference Expense

### Airport Transfer

* Airport Transfer is an Endpoint Transfer subtype
* Airport Transfer references an Airport

### Accommodation

* Accommodation belongs to Visit
* Accommodation may reference Expense

### POI

* POI belongs to City
* POI contains Photo

### Photo

* Photo belongs to City or POI

---

# Domain Rules

## Trip

A normal long-distance Trip:

* contains at least one Visit
* contains at least one Segment
* is represented primarily through its Segments in the current dataset

Short-distance and city trips may behave differently in future MVP+ functionality.

---

## Visit

A continuous stay in the same City is one Visit.

When the traveler temporarily leaves a base/stay City for an excursion of one
or two days and then returns to the same base, the excursion does not split the
base City into two Visits.

Special case:

Barcelona → Andorra → Barcelona may still represent one Barcelona Visit when Barcelona is the continuous base of the trip.

A Visit may contain multiple Accommodation records.

The MVP does not need to materialize the Accommodation-to-Visit association.
Trip and canonical accommodation City are sufficient for the MVP's map and
expense views. Exact Visit assignment remains part of the domain model and may
be materialized later when a Trip contains ambiguous repeated stays.

---

## Segment

A Segment represents a major movement that is meaningful for travel visualization and/or transportation expense analysis.

All movements already recorded as Segments are in MVP scope, including
short-distance and zero-cost Segments. Airport Transfer cost is not used to
decide whether a movement is a Segment.

Zero cost alone does not disqualify a movement from being a Segment. However,
an unrecorded local movement is not promoted to a Segment merely to connect a
visited Country to the route graph. The local Rome-to-Vatican movement is not a
Segment in the current dataset.

When a Segment starts and ends in the same City, its ordered Transit Points
define the non-zero route between the shared endpoints.

### Transportation Classification

The application uses six normalized categories for map styling, filters, and
both Segment-level and Country-level aggregate analysis. The source subtype is
also retained in metadata:

* `High-speed Rail`: 高鐵; red
* `Train`: 火車; pink
* `City Bus`: 公車; light green
* `InterCity Bus`: 客運; green
* `Plane`: 飛機; dark blue
* `Ferry / Cruise`: 郵輪; light blue

---

## Transit Point

A transit point is a City occurring inside a long-distance movement.

Transit Points are stored in travel order in the raw text field. Every listed
Transit Point is an actual visit. Pure transfer-only locations are excluded
from visual analysis and must not be promoted to Transit Points.

Owner-confirmed exception: the SKP airport overnight on 2026-01-20 is represented
as the formal Skopje Transit Point in the Oslo → Munich Segment. It is not
inferred merely from a transfer note; other unconfirmed airport connections
remain excluded. Transit Point markers participate in Segment interactions.

A sufficiently distant Transit Point may receive a navigable City Map in MVP+.
The current threshold is greater than 35 km from the reviewed center-point
station of the canonical City to which that Transit Point belongs.

A transit point may remain inside one Segment rather than becoming two Segments when:

* the journey is effectively one continuous movement
* there is no separate travel/accommodation expense
* the intermediate City has no separate travel or accommodation expense

Example:

Hamburg → Lübeck → Berlin

Lübeck may be treated as a transit point within a Segment if the journey is otherwise continuous.

If a location has a separate travel or accommodation expense, the movement is
split into separate Segments instead of keeping that location only as a Transit
Point.

---

## Endpoint Transfer

Endpoint Transfer is not a Segment. Paid local Endpoint Transfers always
contribute their cost and reviewed endpoint-to-endpoint straight-line distance
to the parent Segment. They do not have independent map paths, transportation
categories, or Country aggregation.

The current local routes are Marseille-Saint-Charles → Marseille Provence
Cruise Terminal, Terminal D Palacruceros ↔ Barcelona Nord, and Utrecht Leidsche
Rijn → Utrecht Centraal.

## Airport Transfer

Airport Transfer is not a Segment.

It may be rendered on the map when sufficiently geographically significant.

Whether it contributes to transportation expense analysis is controlled by the Airport Transfer filter.

If the Airport Transfer cost is zero, it contributes neither cost nor distance to the transportation metric.

In the raw Segment data, the notes field contains exactly three slash-delimited
positions:

1. Segment notes
2. departure Endpoint Transfer notes
3. arrival Endpoint Transfer notes

The departure and arrival notes may include the transfer mode and company. When
present, that text is included in Endpoint Transfer metadata. The MVP does not
require a separately entered transfer date or distance. Transfer distance used
by analysis is derived during preprocessing.

A raw transfer cost of zero covers all of these source-data cases: no transfer,
a free transfer, or a transfer already included in another price. The MVP does
not distinguish those reasons.

---

## Transportation Distance

Base Segment distance is the sum of straight-line (haversine) legs through all
ordered, formally recorded Transit Points:

Origin City reference point → Transit Point reference points → Destination City
reference point. With no Transit Points this is the direct endpoint distance.
The owner confirmed this rule for both different-endpoint journeys and same-city
round trips; it does not change Segment fares or Expense allocation.

Each paid local Endpoint Transfer adds the straight-line distance between its
two reviewed GPS endpoints.

If a non-zero Airport Transfer is included in analysis:

City reference point → Airport distance is added to the Segment distance.

---

## Accommodation Aggregation

Accommodation averages are weighted by number of nights.

For example:

weighted average commute time:

Σ(commute time × nights) / Σ(nights)

Airport overnight stays may optionally be included.

Airport overnight stays:

* have zero accommodation cost
* contribute to accommodation-night calculations when enabled
* do not contribute to commute-time calculations

Raw commute time for an Airport overnight stay may be stored as `0`, but
preprocessing converts it to not-applicable for commute-time analysis.

Accommodation price excludes additional handling fees, taxes, refunds, and
cost-sharing adjustments. Check-in and check-out dates are not required for the
MVP.

Accommodation types are `Airbnb`, `Hostel`, `Hotel`, and `Airport`. `Hostel` is
an independent type.

Country-level Accommodation aggregation uses the Country of the normalized
accommodation City. Airport overnight stays remain included in their assigned
Country when the Airport overnight filter is enabled, even when the airport is
outside the administrative boundary of the associated City.

---

## Country Aggregation

For transportation country-level analysis, a Segment belongs to its origin
Country. Cross-border Segments are not duplicated into the destination Country.

A visited Country with no Segment has no transportation metric. The UI must
present that state as unavailable or no data rather than as a zero-cost
Segment.

---

## Scope Principle

The Domain Model should remain small enough for the current project.

Do not introduce new entities merely because they are technically possible.

New entities should be introduced only when they represent an independently meaningful domain concept or solve a real modeling problem.
