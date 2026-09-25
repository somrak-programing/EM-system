import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AttachmentKind } from "@prisma/client";

import type { RequestPhoto } from "./attachment-rules";

export {
  ALLOWED_PHOTO_TYPES,
  MAX_CAPTION_LENGTH,
  MAX_PHOTO_BYTES,
  MAX_REQUEST_PHOTOS,
  collectRequestPhotos,
} from "./attachment-rules";
export type { PhotoCollectResult, PhotoError, RequestPhoto } from "./attachment-rules";


const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function uploadRoot() {
  return path.join(process.cwd(), "uploads");
}

export async function saveTicketPhotos(
  ticketId: string,
  photos: RequestPhoto[],
  kind: AttachmentKind,
) {
  const dir = path.join(uploadRoot(), "tickets", ticketId);
  await mkdir(dir, { recursive: true });

  const rows = [];
  for (const { file, caption } of photos) {
    const id = randomUUID();
    const ext = EXT[file.type] ?? ".bin";
    const relative = path.posix.join("tickets", ticketId, `${id}${ext}`);
    const absolute = path.join(dir, `${id}${ext}`);
    await writeFile(absolute, Buffer.from(await file.arrayBuffer()));
    rows.push({
      ticketId,
      kind,
      storagePath: relative,
      contentType: file.type,
      caption,
    });
  }
  return rows;
}

export function resolveStoredPath(storagePath: string) {
  const root = path.resolve(uploadRoot());
  const absolute = path.resolve(root, storagePath);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (absolute !== root && !absolute.startsWith(prefix)) {
    throw new Error("invalid storage path");
  }
  return absolute;
}
