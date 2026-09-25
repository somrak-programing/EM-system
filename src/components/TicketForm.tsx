"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createTicketAction } from "@/app/actions";
import { DateTimeField } from "@/components/DateTimeField";
import { PRIORITY_LABEL } from "@/components/PriorityBadge";
import { MAX_CAPTION_LENGTH, MAX_REQUEST_PHOTOS } from "@/lib/attachment-rules";
import {
  addPickedPhotos,
  removePickedPhoto,
  setPickedCaption,
  type PickedPhoto,
} from "@/lib/photo-picker";
import type { TicketType } from "@prisma/client";

type AssetOption = {
  id: string;
  tag: string;
  name: string;
  line: string;
  isElectric: boolean;
};

export function TicketForm({
  assets,
  error,
}: {
  assets: AssetOption[];
  error?: string;
}) {
  const [type, setType] = useState<TicketType>("MACHINE");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [localError, setLocalError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Map<string, string>());
  const needsAsset = type === "MACHINE" || type === "ELECTRIC";
  const filtered = useMemo(
    () =>
      assets.filter((asset) =>
        type === "ELECTRIC" ? asset.isElectric : type === "MACHINE" ? !asset.isElectric : true,
      ),
    [assets, type],
  );

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const errorText: Record<string, string> = {
    type: "เลือกประเภทงานให้ถูกต้อง",
    detail: "กรุณากรอกรายละเอียดปัญหา",
    priority: "กรุณาเลือกความเร่งด่วน",
    due_required: "กรุณาเลือกกำหนดเสร็จ",
    due_invalid: "กำหนดเสร็จไม่ถูกต้อง",
    due_past: "กำหนดเสร็จต้องอยู่ในอนาคต",
    asset: "กรุณาเลือกเครื่องจักร",
    flow: "ยังไม่ได้ตั้งขั้นเริ่มต้นของเส้นทางนี้ ติดต่อแอดมิน",
    photos_max: `แนบได้สูงสุด ${MAX_REQUEST_PHOTOS} รูป`,
    photos_type: "ใช้ได้เฉพาะไฟล์รูป JPG, PNG, WEBP หรือ GIF",
    photos_size: "แต่ละรูปต้องไม่เกิน 5 MB",
  };

  // The object URL is created once per photo so typing a caption never remounts the preview.
  function previewUrl(photo: PickedPhoto) {
    const existing = previewUrls.current.get(photo.id);
    if (existing) return existing;
    const url = URL.createObjectURL(photo.file);
    previewUrls.current.set(photo.id, url);
    return url;
  }

  function syncInput(next: PickedPhoto[]) {
    const input = photoInputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    next.forEach((item) => transfer.items.add(item.file));
    input.files = transfer.files;
  }

  function onPhotosChange(list: FileList | null) {
    const { photos: next, overflow } = addPickedPhotos(
      photos,
      Array.from(list ?? []),
      MAX_REQUEST_PHOTOS,
    );
    setLocalError(overflow ? `แนบได้สูงสุด ${MAX_REQUEST_PHOTOS} รูป` : "");
    setPhotos(next);
    syncInput(next);
  }

  function removePhoto(id: string) {
    const url = previewUrls.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrls.current.delete(id);
    }
    const next = removePickedPhoto(photos, id);
    setLocalError("");
    setPhotos(next);
    syncInput(next);
  }

  function updateCaption(id: string, caption: string) {
    setPhotos((current) => setPickedCaption(current, id, caption));
  }

  return (
    <form action={createTicketAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {error || localError ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {localError || errorText[error ?? ""] || "บันทึกไม่สำเร็จ"}
        </p>
      ) : null}

      <label className="block text-sm font-medium text-slate-700">
        ประเภทงาน
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as TicketType)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        >
          <option value="MACHINE">ซ่อมเครื่องจักร</option>
          <option value="ELECTRIC">ซ่อมไฟฟ้า</option>
          <option value="STAFF">งานพนักงาน EM</option>
          <option value="IT">งาน IT</option>
        </select>
      </label>

      <label className="block text-sm font-medium text-slate-700">
        ความเร่งด่วน
        <select
          name="priority"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        >
          <option value="" disabled>
            เลือกความเร่งด่วน
          </option>
          <option value="NORMAL">{PRIORITY_LABEL.NORMAL}</option>
          <option value="URGENT">{PRIORITY_LABEL.URGENT}</option>
        </select>
      </label>

      {needsAsset ? (
        <label className="block text-sm font-medium text-slate-700">
          เครื่องจักร
          <select name="assetId" required className="mt-1 w-full rounded border border-slate-300 px-3 py-2">
            <option value="">— เลือก Tag / ชื่อ / Line —</option>
            {filtered.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.tag} · {asset.name} · Line {asset.line}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block text-sm font-medium text-slate-700">
          หัวเรื่อง
          <input
            name="subject"
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            placeholder="สรุปงานที่ต้องการ"
          />
        </label>
      )}

      <DateTimeField
        name="discoveredAt"
        label="วันที่พบปัญหา"
        hint="ไม่เลือกก็ได้ ระบบจะใช้เวลาที่ส่งใบงาน"
        quickPicks={[
          { label: "ตอนนี้", shift: {} },
          { label: "1 ชม. ที่แล้ว", shift: { hours: -1 } },
          { label: "เมื่อวาน", shift: { days: -1 } },
        ]}
      />

      <DateTimeField
        name="dueAt"
        label="กำหนดเสร็จ"
        required
        quickPicks={[
          { label: "พรุ่งนี้", shift: { days: 1 } },
          { label: "อีก 3 วัน", shift: { days: 3 } },
        ]}
      />

      <label className="block text-sm font-medium text-slate-700">
        รายละเอียด
        <textarea
          name="detail"
          required
          rows={4}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          placeholder="อาการ / สิ่งที่ต้องการให้ช่างทำ"
        />
      </label>

      <fieldset className="flex flex-wrap gap-4 text-sm text-slate-700">
        <legend className="mb-1 font-medium">ผลกระทบ</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="quality" /> Quality
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="environment" /> Environment
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="safety" /> Safety
        </label>
      </fieldset>

      <div>
        <p className="text-sm font-medium text-slate-700">
          รูปภาพประกอบ (ไม่บังคับ สูงสุด {MAX_REQUEST_PHOTOS} รูป)
        </p>
        <input
          ref={photoInputRef}
          type="file"
          name="photos"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          onChange={(event) => onPhotosChange(event.target.files)}
        />
        <p className="mt-1 text-xs text-slate-500">
          เลือกแล้ว {photos.length}/{MAX_REQUEST_PHOTOS} รูป · ใช้ JPG / PNG / WEBP / GIF · ไม่เกิน 5 MB ต่อรูป
        </p>
        {photos.length > 0 ? (
          <ul className="mt-3 space-y-4">
            {photos.map((item, index) => (
              <li key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="relative bg-slate-900/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl(item)}
                    alt={`พรีวิวรูปที่ ${index + 1}`}
                    className="max-h-[26rem] w-full object-contain"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded-lg bg-black/70 px-3 py-1 text-xs font-medium text-white"
                    onClick={() => removePhoto(item.id)}
                  >
                    ลบรูปนี้
                  </button>
                </div>
                <label className="block px-3 py-3 text-sm font-medium text-slate-700">
                  คำอธิบายรูปที่ {index + 1}
                  <textarea
                    name="photoCaptions"
                    rows={2}
                    maxLength={MAX_CAPTION_LENGTH}
                    value={item.caption}
                    onChange={(event) => updateCaption(item.id, event.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    placeholder="เช่น จุดที่เสีย ตำแหน่งบนเครื่อง หรือสิ่งที่อยากให้ช่างดู"
                  />
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            ยังไม่มีรูปพรีวิว — ส่งใบงานได้เลย หรือเลือกไฟล์เพื่อดูตัวอย่างก่อนส่ง
          </p>
        )}
      </div>

      <button type="submit" className="rounded-lg bg-brand-navy px-4 py-2 font-medium text-white shadow-sm transition hover:bg-brand-navy-dark">
        ส่งใบงาน
      </button>
    </form>
  );
}
