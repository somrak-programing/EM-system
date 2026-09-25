export type PickedPhoto = {
  id: string;
  file: File;
  caption: string;
};

let counter = 0;

function nextId() {
  counter += 1;
  return `photo-${counter}-${Date.now()}`;
}

export function addPickedPhotos(current: PickedPhoto[], files: File[], max: number) {
  const incoming = files
    .filter((file) => file.size > 0)
    .map((file) => ({ id: nextId(), file, caption: "" }));
  const merged = [...current, ...incoming];

  return { photos: merged.slice(0, max), overflow: merged.length > max };
}

export function setPickedCaption(current: PickedPhoto[], id: string, caption: string) {
  return current.map((item) => (item.id === id ? { ...item, caption } : item));
}

export function removePickedPhoto(current: PickedPhoto[], id: string) {
  return current.filter((item) => item.id !== id);
}
