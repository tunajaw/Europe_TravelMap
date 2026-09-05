# Project — Product Definition

## 1. Product Goal

Build an interactive personal travel website that integrates travel records, geographic locations, transportation, accommodation, expenses, and photos collected during my European exchange experience from 2025-09-30 to 2026-04-30.

The website should present these experiences through interactive maps, travel routes, and data visualizations, allowing visitors to intuitively explore my European exchange journey.

The primary goals are:

* Integrate travel data currently distributed across CSV files, Google Maps Timeline JSON, and travel photos.
* Present travel experiences through a hierarchical map structure:

  * Europe
  * Country
  * City
  * POI (MVP+)
* Visualize travel routes between countries and cities.
* Present transportation and accommodation expenses associated with individual trips as map metadata.
* Provide a separate Expense Dashboard for aggregate transportation and accommodation analysis.

---

## 2. Target Users

### Primary Users

The primary users are general visitors who are interested in exploring my European exchange travel experience.

Examples include:

* Friends
* Family members
* Acquaintances
* People interested in European exchange or travel experiences

Their primary goals are to:

* Quickly understand which countries and cities I visited.
* Explore travel routes through an interactive map.
* Explore travel content associated with specific cities.
* View representative travel photos.
* Understand an overview of travel expenses.

### Secondary Consideration

Software Engineer or AI-related interviewers are not considered primary target users.

The project may indirectly demonstrate:

* Software engineering ability
* Data visualization skills
* System design thinking
* AI-native development workflow

However, the product experience should not be designed primarily for interviewers.

---

## 3. Core User Experience

The primary user experience is an interactive travel map.

The intended navigation hierarchy is:

Europe Map
→ Country Map
→ City Map (MVP+)
→ POI Details (MVP+)

Users should be able to visually understand:

* Where I traveled
* How different trips connected cities and countries
* Which transportation modes were used
* Relevant travel metadata
* Representative travel photos

---

## 4. Expense Dashboard

Expense visualization is a secondary feature and should remain simpler than the interactive travel map.

The dashboard contains two modes:

* Transportation
* Accommodation

### Transportation

Transportation analysis focuses on:

* Total cost
* Cost per 100 km
* Transportation mode
* Segment-level comparison
* Country-level aggregation

### Accommodation

Accommodation analysis focuses on:

* Average cost per night
* Commute time to the main railway station
* Accommodation type
* Country-level aggregation

The Expense Dashboard should not expand into a general personal-finance application.

---

## 5. MVP

### Travel Map

The MVP includes:

* Europe Map
* Visited-country markers
* Country selection
* Country Map
* Visited-city markers
* Back-to-previous-level navigation
* Segment visibility toggle
* Segment rendering
* Segment interaction
* Segment metadata

### Expense Dashboard

The MVP includes:

* Transportation / Accommodation mode selection
* Transportation-category filters
* Accommodation-category filters
* Transportation cost visualization
* Transportation cost-per-100-km visualization
* Accommodation average-nightly-cost visualization
* Accommodation commute-time visualization
* Horizontal barplots
* Country-level heatmaps
* Basic filtering and sorting

---

## 6. MVP+

Potential future features include:

* City Map interaction
* POI display
* POI-level photos
* Google Maps Timeline-based location reconstruction
* Short-distance trips on the map
* Trip filtering
* More detailed timeline exploration

These features should not be implemented unless they are explicitly promoted into the active project scope.

---

## 7. Out of Scope

Unless explicitly added later, the following are out of scope:

* General personal finance tracking
* Real-time travel information
* User accounts
* Social networking
* Multi-user travel planning
* Real-time collaboration
* Complex recommendation systems
* Large-scale data infrastructure
* Full Google Maps replacement
