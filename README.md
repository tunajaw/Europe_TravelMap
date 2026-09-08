# Europe Travel Map

A personal, interactive record of European travel from 2025-09-30 through
2026-04-30. The MVP is a static React and TypeScript application designed for
GitHub Pages; UI implementation follows the completed architecture and initial
data-preprocessing foundation.

## Development

Use Node.js 24 LTS, then install and verify the project:

```sh
npm ci
npm run check
```

To rebuild the public application dataset, first provide the ignored private
file `data/private/accommodation-raw.csv`, then run:

```sh
npm run data:build
```

The generated `public/data/travel-data.json` is safe for the public application:
it excludes exact Accommodation addresses and source Accommodation names.

To build and open the production preview on Windows, run:

```powershell
.\preview.cmd
```

The preview is served at `http://127.0.0.1:4173/Europe_TravelMap/`. Press
`Ctrl+C` in the terminal to stop it.

The main view uses the approved Modern Cartographic design. Select a country
marker (mouse, touch, or keyboard) to open its photos, then choose Enter to frame
the Country Map. Click outside the card or press Escape to return to Europe.
Country links such as `/Europe_TravelMap/#country/italy` restore the view directly.
Country Maps show visited City markers and a translucent country name. Use the
top-left Back to Europe button to zoom out. Show travel routes toggles Segment
visibility and keeps its setting across navigation. Hover or click a route to
expand overlapping routes; press Escape or click outside to clear the selection.
FR-MAP-01 through FR-MAP-06 are implemented. Linked-marker highlighting and
Segment metadata are the next increments (FR-MAP-07 onward).

CI runs type checking, domain tests (`npm run test:domain`), preprocessing tests (`npm run test:preprocess`), UI/map
tests (`npm run test:ui`), public-data validation, and a production build.

For the three visual design studies, open
`http://127.0.0.1:4173/Europe_TravelMap/?view=mockups` after starting the preview.
The comparison supports individual enlarged views and synchronized Italy photo
selection. Dashboard counts come from the public dataset; country navigation
and expense interactions are visual placeholders pending design selection.

Architecture, domain rules, and preprocessing decisions are documented under
[`docs/`](docs/).
