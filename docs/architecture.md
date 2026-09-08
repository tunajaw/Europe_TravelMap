# MVP Architecture

## Decision Summary

Project A is a static, client-rendered single-page application deployed to
GitHub Pages. It has no production backend and no MVP database.

The selected stack is:

* React with TypeScript for UI composition and stateful interaction;
* Vite for local development and production builds;
* React-rendered SVG using focused D3 modules for geographic projections,
  curved Segment paths, scales, and charts;
* pinned World Atlas 2.0.2 110m geographic boundary data derived from Natural
  Earth 4.1.0, joined through reviewed ISO numeric boundary IDs;
* Zod for the runtime application-data contract;
* Vitest for domain, preprocessing, and component tests;
* React Testing Library for user-visible component behavior;
* Playwright for a small set of end-to-end navigation and interaction tests;
* GitHub Actions for verification and GitHub Pages deployment.

Node.js 24 LTS is the supported development and CI runtime.

## Why This Architecture

The product is read-only and its complete MVP dataset is small. Static JSON and
static image assets are therefore simpler, cheaper, and easier to audit than a
database or API. GitHub Pages can serve the complete application without
runtime infrastructure.

SVG is a better fit than a tile-based map SDK for the current requirements:
the UI needs country boundaries, markers, deterministic curved routes,
highlighting, zoom transitions, and heatmaps rather than street-level tiles or
live routing. D3 supplies the geometry primitives while React remains the owner
of rendered elements and interaction state.

## Data Flow

```text
tracked raw/reference CSV + ignored private Accommodation CSV
                         |
                         v
              TypeScript preprocessing
                         |
                         v
        validated public/data/travel-data.json
                         |
                         v
              React selectors and views
```

The preprocessing command runs locally because the complete Accommodation
source is intentionally absent from the public repository. Its sanitized JSON
output is reviewed and committed. CI validates the committed output but does
not require the private input.

## Application Data Boundary

`public/data/travel-data.json` is the only travel-data input consumed by the
browser. UI code must not parse raw CSV, call a geocoder, or infer domain
relationships.

The output contains normalized Countries, Cities, Airports, Trips, Segments,
Transfers, Accommodations, and Photos. It excludes exact accommodation
addresses, geocoder query details, and private source filenames.

Image paths are stored relative to the Vite public base so the application works
under the GitHub Pages project path `/Europe_TravelMap/`.

## Map and Route Geometry

Country boundaries are supplied by a package-lock-pinned build dependency and
bundled into the application rather than fetched at runtime.
The same projection and geographic source are shared by the travel map and
expense heatmaps.

Segment display geometry is a deterministic curved SVG path through the ordered
origin, Transit Points, and destination. Parallel Segments receive stable curve
offsets so overlapping routes can fan out on interaction. These curves are a
visual encoding, not claims about the actual road, rail, sea, or flight path.

Metric distance uses the haversine distance between reviewed reference points.
For a same-origin-and-destination Segment, the ordered Transit Points form the
distance legs so the result is not incorrectly zero.

## State and Navigation

The approved visual direction is Modern Cartographic (design study A): cool
off-white surfaces, low-saturation blue-gray geography, sans-serif typography,
and a right-hand summary dashboard. The main heading uses weight 500 following
owner review. Map markers retain the gray/black interaction states required by
FR-MAP-01/02; blue is reserved for UI accents.

MVP interaction state is local client state managed with React reducers and
derived selectors. A separate state library is not justified initially.

Map level and selection are encoded in the URL hash. Hash-based navigation is
compatible with GitHub Pages because direct requests do not require server-side
SPA fallback routing.

FR-MAP-02 uses `#europe`, `#europe/<country-id>` (selected preview), and
`#country/<country-id>` (entered Country Map). Browser history and direct links
restore these states; unrecognized country IDs fall back to Europe. Selecting
another country resets its photo to the first chronological image. Escape,
the close button, and the Back to Europe control dismiss the selection; keyboard
dismissal restores focus to the marker. Clicking outside the preview also clears
selection, except on country-selection controls.

Country framing uses visible European boundary coordinates and a minimum extent
around a microstate marker when no polygon exists. Markers keep their screen
size when zoomed. FR-MAP-03 will add City markers to the entered Country Map.
The photo card occupies a reserved area below the geographic viewport so it
does not cover markers. Segment-aware floating placement remains to be verified
when FR-MAP-06 introduces routes. The sidebar currently reports Segment counts
(selected-country counts use origin Country), not Expense metrics; a country
without transportation records displays an empty state.

## Testing Strategy

Map refinement: selected/hovered borders have a separate stroke-only overlay
above all country fills. The Europe overview uses a tighter viewport while
Country Map framing remains independent. Photo cards use a horizontal strip
with bounded previous/next controls; chart fills replay on country changes.
Both animations respect reduced-motion preferences. CountryPhoto applies
reviewed 180-degree display corrections to country-germany-02 (display order 1),
country-lithuania-01, and country-lithuania-02. Original asset bytes are unchanged;
future image-export work must bake these corrections before removing the UI rule.

1. Pure preprocessing and metric functions are developed with Vitest.
2. The committed JSON is validated against its Zod contract and referential
   integrity rules.
3. React Testing Library covers filters, selections, metadata, and navigation.
4. Playwright covers only critical cross-view flows on the production build.

Tests must not contain exact accommodation addresses or copy private source
rows. Sanitized synthetic fixtures cover privacy-sensitive transformations.

## Deployment

Vite uses `/Europe_TravelMap/` as its production base. A GitHub Actions Pages
workflow will run checks, build `dist/`, upload the artifact, and deploy from
the repository's default branch. The repository owner must select **GitHub
Actions** as the Pages source in repository settings.

The Pages workflow builds and verifies the first UI shell, uploads `dist/`, and
deploys it from the default branch.

## Deferred Decisions

The following are intentionally postponed until they become relevant:

* a database or backend API;
* server-side rendering;
* live map tiles or directions APIs;
* POI and Photo-to-POI relationships;
* City Map drill-down beyond the current MVP scope;
* analytics, accounts, and content-management tooling.
