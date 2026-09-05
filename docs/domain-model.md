# Project — Domain Model

## Entities

### Country

A country visited during the exchange period.

Examples:

* France
* Germany
* Italy

---

### City

A city actually visited during the exchange period.

Examples:

* Paris
* Munich
* Barcelona

A City may be visited multiple times across different Trips.

---

### Trip

A logical travel journey.

For the current dataset, a Trip is primarily represented by its Segments.

A Trip normally starts and ends at the exchange base city.

A Trip may contain multiple Segments.

Trip is a backend/domain concept and does not necessarily correspond directly to a visible UI element in MVP.

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
* optional Airport Transfers

A Segment is the primary unit for travel-path visualization and transportation expense analysis.

---

### Airport Transfer

Transportation between a city and an airport.

Examples:

* Milan → BGY
* BGY → Milan
* STN → London

Airport Transfer is NOT a Segment.

It may be associated with a Segment and may optionally be included in transportation expense analysis.

Airport Transfers may have:

* price
* transportation company
* notes
* distance

---

### Accommodation

A place where the user stayed during a Visit.

Examples:

* Airbnb
* Hotel
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
* Vatican City
* museums
* attractions

POIs are primarily MVP+.

---

### Photo

A travel photo or photo group.

Photos may be associated with:

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
* Country contains Segment
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
* Segment may contain Airport Transfer
* Segment may reference Expense

### Airport Transfer

* Airport Transfer belongs to Segment
* Airport Transfer may reference Expense

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

Special case:

Barcelona → Andorra → Barcelona may still represent one Barcelona Visit when Barcelona is the continuous base of the trip.

A Visit may contain multiple Accommodation records.

---

## Segment

A Segment represents a major movement that is meaningful for travel visualization and/or transportation expense analysis.

A short movement may not become a Segment if:

* it is short
* it produces no additional travel expense
* it is better represented as a POI

---

## Transit Point

A transit point is a City occurring inside a long-distance movement.

A transit point may remain inside one Segment rather than becoming two Segments when:

* the journey is effectively one continuous movement
* there is no separate travel/accommodation expense
* the intermediate city is mainly a transit location

Example:

Hamburg → Lübeck → Berlin

Lübeck may be treated as a transit point within a Segment if the journey is otherwise continuous.

However, Lübeck may still be represented as a City for geographic/map purposes if its travel significance warrants it.

---

## Airport Transfer

Airport Transfer is not a Segment.

It may be rendered on the map when sufficiently geographically significant.

Whether it contributes to transportation expense analysis is controlled by the Airport Transfer filter.

If the Airport Transfer cost is zero, it contributes neither cost nor distance to the transportation metric.

---

## Transportation Distance

Base Segment distance is the straight-line distance between:

Origin City Hbf → Destination City Hbf.

If a non-zero Airport Transfer is included in analysis:

Hbf → Airport distance is added to the Segment distance.

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

---

## Scope Principle

The Domain Model should remain small enough for the current project.

Do not introduce new entities merely because they are technically possible.

New entities should be introduced only when they represent an independently meaningful domain concept or solve a real modeling problem.
