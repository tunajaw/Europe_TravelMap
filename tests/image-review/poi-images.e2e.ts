import { expect, test } from '@playwright/test';

test('dragging gallery photos saves their order across reload and duplicate imports', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('./#city/city-munich');
  const target = page.getByRole('button', { name: /^Focus / }).first();
  const name = (await target.getAttribute('aria-label'))!.slice('Focus '.length);
  const badge = page.getByRole('button', { name: `View images for ${name}`, exact: true });
  const makeTransfer = () => page.evaluateHandle(async () => {
    const moduleUrl = '/Europe_TravelMap/src/features/map/poi-image-store.ts';
    const { loadPoiImages } = await import(/* @vite-ignore */ moduleUrl);
    await loadPoiImages();
    const result = new DataTransfer();
    for (const [name, color] of [['a.png', 'red'], ['b.png', 'green'], ['c.png', 'blue']]) {
      const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = color!; ctx.fillRect(0, 0, 1, 1);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((file) => resolve(file!), 'image/png'));
      result.items.add(new File([blob], name!, { type: 'image/png' }));
    }
    return result;
  });
  await target.dispatchEvent('drop', { dataTransfer: await makeTransfer() });
  await expect(badge).toHaveText('3');
  await badge.click();
  const gallery = page.getByRole('dialog');
  await gallery.getByLabel('Reorder a.png', { exact: true }).dragTo(gallery.getByLabel('Reorder c.png', { exact: true }));
  await expect(gallery.locator('figcaption')).toHaveText(['b.png', 'c.png', 'a.png']);
  await page.reload();
  await badge.click();
  await expect(gallery.locator('figcaption')).toHaveText(['b.png', 'c.png', 'a.png']);
  await gallery.getByRole('button', { name: 'Close image gallery' }).click();
  await target.dispatchEvent('drop', { dataTransfer: await makeTransfer() });
  await expect(page.getByRole('status')).toContainText('3 image(s) saved locally.');
  await badge.click();
  await expect(gallery.locator('figcaption')).toHaveText(['b.png', 'c.png', 'a.png']);
});

test('selecting a map POI brings its list item into view without moving the page or viewport', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('./#city/city-munich');
  const map = page.getByRole('group', { name: 'Munich city map' });
  const marker = map.locator('[data-poi-id]').last();
  const name = await marker.getAttribute('aria-label');
  const button = page.getByRole('button', { name: `Focus ${name}`, exact: true });
  const viewport = await map.getAttribute('data-geo-bounds');
  const scrollY = await page.evaluate(() => window.scrollY);
  await marker.dispatchEvent('click');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => button.evaluate((element) => {
    const row = element.getBoundingClientRect();
    const list = element.closest('.city-poi-dashboard-list')!.getBoundingClientRect();
    return row.top >= list.top - 1 && row.bottom <= list.bottom + 1;
  })).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await expect(map).toHaveAttribute('data-geo-bounds', viewport!);
});

test('strips source metadata and motion tails and retains only the first animation frame', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('./#city/city-munich');
  const result = await page.evaluate(async () => {
    // Dynamic URL import exercises the real development-mode sanitizer.
    const moduleUrl = '/Europe_TravelMap/src/features/map/sanitize-poi-image.ts';
    const { sanitizePoiImage } = await import(/* @vite-ignore */ moduleUrl);
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 3;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ff0000'; context.fillRect(0, 0, 2, 3);
    const jpeg = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/jpeg'));
    const original = new Uint8Array(await jpeg.arrayBuffer());
    const make = new TextEncoder().encode('PRIVATE_DEVICE_MODEL\0');
    const tiff = new Uint8Array(38 + make.length);
    tiff.set([73, 73, 42, 0, 8, 0, 0, 0, 2, 0, 15, 1, 2, 0]);
    new DataView(tiff.buffer).setUint32(14, make.length, true);
    new DataView(tiff.buffer).setUint32(18, 38, true);
    tiff.set([18, 1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0], 22);
    tiff.set(make, 38);
    const app1 = new Uint8Array(4 + 6 + tiff.length);
    app1.set([255, 225, (app1.length - 2) >> 8, (app1.length - 2) & 255, 69, 120, 105, 102, 0, 0]);
    app1.set(tiff, 10);
    const source = new Blob([original.slice(0, 2), app1, original.slice(2), 'PRIVATE_GPS_XMP_MOTION_VIDEO'], { type: 'image/jpeg' });
    const clean = await sanitizePoiImage(source);
    const cleanText = new TextDecoder().decode(await clean.arrayBuffer());
    const still = await createImageBitmap(clean);

    // A minimal two-frame GIF: first red, then blue.
    const gif = new Uint8Array([
      71,73,70,56,57,97,1,0,1,0,128,0,0,255,0,0,0,0,255,
      33,249,4,0,1,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,
      33,249,4,0,1,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,76,1,0,59,
    ]);
    const firstFrame = await sanitizePoiImage(new Blob([gif], { type: 'image/gif' }));
    const decoded = await createImageBitmap(firstFrame);
    const check = document.createElement('canvas'); check.width = 1; check.height = 1;
    const pixels = check.getContext('2d')!;
    pixels.drawImage(decoded, 0, 0);
    const rgba = Array.from(pixels.getImageData(0, 0, 1, 1).data);
    const bytes = new Uint8Array(await firstFrame.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    const answer = { type: clean.type, width: still.width, height: still.height,
      containsPrivateData: /PRIVATE_|Exif|xmp/i.test(cleanText),
      animationType: firstFrame.type, animatedPng: text.includes('acTL'), rgba };
    still.close(); decoded.close();
    return answer;
  });
  expect(result).toEqual({ type: 'image/png', width: 3, height: 2,
    containsPrivateData: false, animationType: 'image/png', animatedPng: false, rgba: [255, 0, 0, 255] });
});

test('sanitizes legacy browser images before returning them to the UI', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('./#city/city-munich');
  const result = await page.evaluate(async () => {
    const moduleUrl = '/Europe_TravelMap/src/features/map/poi-image-store.ts';
    const { loadPoiImages, addPoiImage } = await import(/* @vite-ignore */ moduleUrl);
    await loadPoiImages();
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const png = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/png'));
    const legacyBlob = new Blob([png, 'PRIVATE_GPS_DEVICE_VIDEO']);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('travel-map-poi-image-review', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').put({ id: 'legacy', poiId: 'test', name: 'legacy.png', blob: legacyBlob });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
      request.onerror = () => reject(request.error);
    });
    const [image] = await loadPoiImages();
    const [persisted] = await loadPoiImages();
    let rejected = false;
    try { await addPoiImage('test', new File(['not an image'], 'invalid.png', { type: 'image/png' })); }
    catch { rejected = true; }
    return { version: image.sanitizationVersion, type: image.blob.type,
      privateData: (await image.blob.text()).includes('PRIVATE_'),
      storedVersion: persisted.sanitizationVersion, rejected, count: (await loadPoiImages()).length };
  });
  expect(result).toEqual({ version: 1, type: 'image/png', privateData: false, storedVersion: 1, rejected: true, count: 1 });
});

test('persists dropped images across reload and removes an assignment in the modal', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('./#city/city-munich');
  const target = page.getByRole('button', { name: /^Focus / }).first();
  const targetLabel = await target.getAttribute('aria-label');
  const name = targetLabel!.slice('Focus '.length);
  const badge = page.getByRole('button', { name: `View images for ${name}`, exact: true });
  await expect(target).toBeVisible();
  // Wait for the local database to be opened before dropping files.
  await page.waitForFunction(async () => (await indexedDB.databases()).some((db) => db.name === 'travel-map-poi-image-review'));
  const transfer = await page.evaluateHandle(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const bytes = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]!), (char) => char.charCodeAt(0));
    const result = new DataTransfer();
    result.items.add(new File([bytes], 'test.png', { type: 'image/png' }));
    result.items.add(new File([bytes], 'duplicate.png', { type: 'image/png' }));
    return result;
  });
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(badge).toHaveText('1');
  await page.reload();
  await expect(badge).toHaveText('1');
  await badge.click();
  const gallery = page.getByRole('dialog', { name: `Images for ${name}` });
  await expect(gallery.getByRole('img')).toBeVisible();
  await expect(gallery.getByRole('img')).toHaveJSProperty('naturalWidth', 1);
  await page.mouse.click(2, 2);
  await expect(gallery).toBeHidden();
  await expect(page).toHaveURL(/#city\/city-munich$/);
  await badge.click();
  await page.keyboard.press('Escape');
  await expect(gallery).toBeHidden();
  await expect(page).toHaveURL(/#city\/city-munich$/);
  await badge.click();
  await gallery.getByRole('button', { name: /^Remove / }).click();
  await expect(badge).toHaveCount(0);
  await expect(gallery).toContainText('No images assigned');
  await page.reload();
  await expect(target).toBeVisible();
  await expect(badge).toHaveCount(0);
});
