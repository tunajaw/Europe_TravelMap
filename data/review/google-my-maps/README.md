# Google My Maps Location Review

These files preserve the completed manual map review. They are not
application-ready data; authoritative approval states are stored in the
corresponding files under `data/parsed/`.

## Recommended import

Create four Google My Maps layers and import one CSV into each layer, in file
number order. Select `Latitude` and `Longitude` as the location columns and
`Title` as the marker title. Import the CSV files, not the KML, if Google My
Maps reports a field-name validation error.

Apply these layer styles:

1. `01-country-markers.csv`: red star; each marker uses the capital-City rule.
2. `02-city-gps.csv`: blue circle; each marker is a City reference-point candidate.
3. `03-airport-gps.csv`: airplane icon; each marker is an airport candidate.
4. `04-location-aliases.csv`: yellow diamond; each marker shows a raw label to
   canonical target relationship.

`location-review.kml` provides the same records with predefined icons for quick
preview. Google My Maps may not preserve KML folders during import, so the four
CSV files are the authoritative layer-import format.

## Alias-coordinate limitation

A Location alias is a relationship, not a separate geocoded physical object.
Its review marker is deliberately placed at the mapped canonical City or Airport
candidate coordinate. Overlapping yellow markers are therefore expected.

After review, record decisions in the corresponding files under `data/parsed/`;
do not treat edits made only in Google My Maps as authoritative project data.
