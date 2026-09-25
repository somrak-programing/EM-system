import { describe, expect, it } from "vitest";
import { collectRequestPhotos } from "./attachment-rules";

function photo(name: string, type = "image/jpeg", size = 1200) {
  return new File([new Uint8Array(size)], name, { type });
}

function form(...files: File[]) {
  const data = new FormData();
  for (const file of files) data.append("photos", file);
  return data;
}

function formWithCaptions(pairs: [File, string][]) {
  const data = new FormData();
  for (const [file, caption] of pairs) {
    data.append("photos", file);
    data.append("photoCaptions", caption);
  }
  return data;
}

describe("collectRequestPhotos", () => {
  it("allows submitting with no photos", () => {
    const result = collectRequestPhotos(form());
    expect(result).toEqual({ ok: true, photos: [] });
  });

  it("accepts up to four jpeg images", () => {
    const files = [photo("1.jpg"), photo("2.jpg"), photo("3.jpg"), photo("4.jpg")];
    const result = collectRequestPhotos(form(...files));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.photos).toHaveLength(4);
  });

  it("keeps each caption with its own photo", () => {
    const first = photo("1.jpg");
    const second = photo("2.jpg");
    const result = collectRequestPhotos(
      formWithCaptions([
        [first, "  มอเตอร์ฝั่งซ้ายมีรอยไหม้  "],
        [second, "สายพานหลุดจากร่อง"],
      ]),
    );

    expect(result).toEqual({
      ok: true,
      photos: [
        { file: first, caption: "มอเตอร์ฝั่งซ้ายมีรอยไหม้" },
        { file: second, caption: "สายพานหลุดจากร่อง" },
      ],
    });
  });

  it("stores a missing caption as null", () => {
    const only = photo("1.jpg");
    const result = collectRequestPhotos(formWithCaptions([[only, "   "]]));

    expect(result).toEqual({ ok: true, photos: [{ file: only, caption: null }] });
  });

  it("rejects more than four images", () => {
    const result = collectRequestPhotos(
      form(
        photo("1.jpg"),
        photo("2.jpg"),
        photo("3.jpg"),
        photo("4.jpg"),
        photo("5.jpg"),
      ),
    );
    expect(result).toEqual({ ok: false, error: "photos_max" });
  });

  it("rejects a non-image file among the photos", () => {
    const result = collectRequestPhotos(
      form(photo("1.jpg"), new File([new Uint8Array(40)], "note.txt", { type: "text/plain" })),
    );
    expect(result).toEqual({ ok: false, error: "photos_type" });
  });

  it("rejects an oversized image", () => {
    const result = collectRequestPhotos(
      form(photo("huge.jpg", "image/jpeg", 6 * 1024 * 1024)),
    );
    expect(result).toEqual({ ok: false, error: "photos_size" });
  });
});
