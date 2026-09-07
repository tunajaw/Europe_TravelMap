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

Architecture, domain rules, and preprocessing decisions are documented under
[`docs/`](docs/).
