import { describe, expect, it } from "vitest";
import { addPickedPhotos, removePickedPhoto, setPickedCaption } from "./photo-picker";

function photo(name: string) {
  return new File([new Uint8Array(64)], name, { type: "image/png" });
}

describe("photo picker state", () => {
  it("gives every picked photo its own stable id", () => {
    const { photos } = addPickedPhotos([], [photo("a.png"), photo("b.png")], 4);

    expect(photos).toHaveLength(2);
    expect(photos[0].id).not.toBe(photos[1].id);
  });

  it("keeps the same identity when a caption changes", () => {
    const { photos } = addPickedPhotos([], [photo("a.png"), photo("b.png")], 4);
    const updated = setPickedCaption(photos, photos[0].id, "มอเตอร์มีรอยไหม้");

    expect(updated[0].id).toBe(photos[0].id);
    expect(updated[0].file).toBe(photos[0].file);
    expect(updated[0].caption).toBe("มอเตอร์มีรอยไหม้");
    expect(updated[1]).toBe(photos[1]);
  });

  it("reports overflow and keeps only the allowed number of photos", () => {
    const first = addPickedPhotos([], [photo("a.png"), photo("b.png")], 2);
    const second = addPickedPhotos(first.photos, [photo("c.png")], 2);

    expect(second.overflow).toBe(true);
    expect(second.photos).toHaveLength(2);
    expect(second.photos[0]).toBe(first.photos[0]);
  });

  it("removes one photo without touching the others", () => {
    const { photos } = addPickedPhotos([], [photo("a.png"), photo("b.png")], 4);
    const remaining = removePickedPhoto(photos, photos[0].id);

    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toBe(photos[1]);
  });
});
