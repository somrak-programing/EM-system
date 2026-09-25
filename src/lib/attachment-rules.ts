export const MAX_REQUEST_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_CAPTION_LENGTH = 300;
export const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type PhotoError = "photos_max" | "photos_type" | "photos_size";

export type RequestPhoto = { file: File; caption: string | null };

export type PhotoCollectResult =
  | { ok: true; photos: RequestPhoto[] }
  | { ok: false; error: PhotoError };

export function collectRequestPhotos(formData: FormData): PhotoCollectResult {
  const entries = formData.getAll("photos");
  const captions = formData.getAll("photoCaptions");
  const photos: RequestPhoto[] = [];

  entries.forEach((entry, index) => {
    if (!(entry instanceof File) || entry.size === 0) return;
    const raw = captions[index];
    const caption = typeof raw === "string" ? raw.trim().slice(0, MAX_CAPTION_LENGTH) : "";
    photos.push({ file: entry, caption: caption || null });
  });

  if (photos.length > MAX_REQUEST_PHOTOS) {
    return { ok: false, error: "photos_max" };
  }

  for (const { file } of photos) {
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      return { ok: false, error: "photos_type" };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return { ok: false, error: "photos_size" };
    }
  }

  return { ok: true, photos };
}
