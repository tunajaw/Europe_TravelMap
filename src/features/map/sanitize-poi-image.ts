/** Decode only the first frame, apply EXIF orientation, then encode fresh pixels. */
export async function sanitizePoiImage(blob: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    // createImageBitmap uses the first frame of animated image sources. Drawing
    // pixels to a new canvas drops EXIF/XMP, embedded thumbnails and video tails.
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Could not decode the image. Convert it to JPEG or PNG and try again.');
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image conversion is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result)
        : reject(new Error('Could not encode the static image.')), 'image/png');
    });
  } finally {
    bitmap.close();
  }
}
