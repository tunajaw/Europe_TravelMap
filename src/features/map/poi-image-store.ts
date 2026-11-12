import { sanitizePoiImage } from './sanitize-poi-image.ts';

export type PoiReviewImage = {
  id: string;
  poiId: string;
  name: string;
  blob: Blob;
  sanitizationVersion?: 1;
  position?: number;
};

const DATABASE = 'travel-map-poi-image-review';
const STORE = 'images';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

export function sortPoiImages(images: PoiReviewImage[]): PoiReviewImage[] {
  return [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other image review tabs and try again.'));
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Image storage transaction aborted.'));
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function loadPoiImages(): Promise<PoiReviewImage[]> {
  const images: PoiReviewImage[] = await transact('readonly', (store) => store.getAll());
  const cleaned: PoiReviewImage[] = [];
  for (const [index, image] of images.entries()) {
    if (image.sanitizationVersion === 1 && image.position !== undefined) { cleaned.push(image); continue; }
    const blob = image.sanitizationVersion === 1 ? image.blob : await sanitizePoiImage(image.blob);
    const migrated: PoiReviewImage = { ...image, blob, sanitizationVersion: 1, position: image.position ?? index };
    await transact('readwrite', (store) => store.put(migrated));
    cleaned.push(migrated);
  }
  return sortPoiImages(cleaned);
}

async function updatePoiImages(
  poiId: string,
  update: (images: PoiReviewImage[]) => PoiReviewImage[],
): Promise<PoiReviewImage[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const request = store.getAll();
      let updated: PoiReviewImage[] = [];
      request.onsuccess = () => {
        const existing = (request.result as PoiReviewImage[]).filter((image) => image.poiId === poiId);
        updated = update(sortPoiImages(existing));
        for (const image of updated) store.put(image);
      };
      transaction.oncomplete = () => resolve(updated);
      transaction.onabort = () => reject(transaction.error ?? new Error('Image storage transaction aborted.'));
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export function movePoiImage(poiId: string, sourceId: string, targetId: string): Promise<PoiReviewImage[]> {
  return updatePoiImages(poiId, (images) => {
    const sourceIndex = images.findIndex(({ id }) => id === sourceId);
    const targetIndex = images.findIndex(({ id }) => id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return images;
    const [source] = images.splice(sourceIndex, 1);
    images.splice(targetIndex, 0, source!);
    return images.map((image, position) => ({ ...image, position }));
  });
}

export async function addPoiImage(poiId: string, file: File): Promise<PoiReviewImage> {
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Use JPEG, PNG, WebP, GIF or AVIF images.');
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error('Each image must be between 1 byte and 25 MB.');
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const blob = await sanitizePoiImage(file);
  const image: PoiReviewImage = { id: `${poiId}:${hash}`, poiId, name: file.name, blob, sanitizationVersion: 1 };
  const saved = await updatePoiImages(poiId, (images) => {
    if (images.some(({ id }) => id === image.id)) return images;
    const position = Math.max(-1, ...images.map((existing) => existing.position ?? 0)) + 1;
    return [...images, { ...image, position }];
  });
  return saved.find(({ id }) => id === image.id)!;
}

export async function removePoiImage(id: string): Promise<void> {
  await transact('readwrite', (store) => store.delete(id));
}
