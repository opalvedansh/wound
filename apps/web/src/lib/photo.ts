const MAX_SIDE = 2048;

/**
 * Redraws the photo before upload: upright (EXIF rotation applied), at most 2048 px on the long side, as JPEG.
 * This shrinks the upload, converts formats the model can't read (such as HEIC, where the browser can decode
 * it), and drops the photo's metadata, including its location.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPEG, PNG or HEIC).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo can't be read in this browser. Take it with the camera, or save it as JPEG first.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The photo couldn't be prepared. Try again."))), "image/jpeg", 0.92),
  );
}
