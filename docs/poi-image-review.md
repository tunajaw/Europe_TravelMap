# Internal POI image review

This temporary tool assigns local image files to approved POI IDs in City Map.
It is available only through the Vite development server (`npm run dev`), not
in the production build or GitHub Pages deployment. On Windows, `preview.cmd`
starts this review-enabled development server and opens
`http://127.0.0.1:4183/Europe_TravelMap/` with a fixed port. It does not build or
launch the production-only preview. If that port is already occupied, reuse the
running development page or stop its server before launching again.

## Interaction

Drop one or multiple image files on a POI button in the right-hand list. The
button highlights during drag-over. Alt-click a POI button to use a file picker
as an alternative. Ordinary clicks still focus the POI on the map.

A count badge in the upper-right corner appears when the POI has images.
Clicking the badge opens a modal gallery containing all assigned images. Each
image has an upper-right remove button. Removing an image deletes its local
assignment and stored copy, leaving the original source file intact. Clicking
outside the gallery, pressing Escape, or using its close button returns to the
same City Map. The modal traps focus and restores focus to the count badge
when it still exists. Drag a photo onto another photo to move it to that
position. Alt + arrow keys offer the same ordering action for a focused photo.
Order changes save automatically, and the gallery retains that order after a
reload. Newly assigned images appear last; adding a duplicate preserves its
existing position. The list must not reduce the Map panel width.

## Local persistence and privacy

IndexedDB database `travel-map-poi-image-review` stores the POI ID, original file
name, image Blob, position, and a content hash used as the assignment key. Dropping the
same bytes on the same POI updates that assignment rather than duplicating it.
The same image may be assigned to separate POIs. Reloading the page or switching
cities retains assignments within the same browser profile and origin.

Accepted formats are JPEG, PNG, WebP, GIF, and AVIF, up to 25 MB per file.
Unsupported files and storage failures are reported without increasing the
saved count. The saved count updates only after the database transaction commits.
Dropping files automatically sanitizes and saves each successful image and its
POI assignment; no separate Save action is required. Wait for the saved count
and the saved-locally status before closing the page. Deletions are also saved
automatically. This updates browser storage only, not a repository file.

Files are stored locally without uploads, repository writes, raw-data changes,
or changes to the published dataset. Before storage, each file is decoded with
`createImageBitmap` using its first frame and EXIF orientation, drawn to a fresh
canvas, and encoded as a lossless static PNG at its original oriented dimensions.
Only pixel content is retained: original GPS, device/EXIF, XMP, embedded thumbnails,
animation frames, and Motion Photo video tails are not copied. The original name
remains an internal reference; the stored Blob is PNG regardless of its name.
Existing unsanitized browser records are converted on load before being exposed
to the UI. A conversion failure blocks that load rather than displaying originals.
Source files on disk remain intact. PNG copies may require more browser storage.
OSM tiles continue to follow the existing City Map network behavior.

This browser database is a working copy, not a backup. Clearing site data,
private-browsing cleanup, storage eviction, or changing browser/profile/port may
make the assignments unavailable. Export/import and publication of reviewed
images are separate follow-up work; no approved public image manifest is generated
by this tool yet. Use a consistent local URL and retain all original files.

## Verification

Run `npm run check` for application tests and the production build. Run
`npx playwright test --config playwright.image-review.config.ts` for the separate
development-mode browser test. It verifies real IndexedDB persistence, content
deduplication, preview decoding, deletion, and modal dismissal without navigation.
