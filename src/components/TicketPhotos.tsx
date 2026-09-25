type Photo = {
  id: string;
  kind: "REQUEST" | "RESULT";
  caption: string | null;
};

const KIND_LABEL = {
  REQUEST: "รูปตอนแจ้งซ่อม",
  RESULT: "รูปหลังซ่อม",
} as const;

export function TicketPhotos({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500">ยังไม่มีรูปภาพแนบกับใบงานนี้</p>
    );
  }

  const request = photos.filter((item) => item.kind === "REQUEST");
  const result = photos.filter((item) => item.kind === "RESULT");

  return (
    <div className="mt-5 space-y-5">
      <Gallery title={KIND_LABEL.REQUEST} items={request} />
      {result.length > 0 ? <Gallery title={KIND_LABEL.RESULT} items={result} /> : null}
    </div>
  );
}

function Gallery({ title, items }: { title: string; items: Photo[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-medium text-slate-700">
        {title} ({items.length})
      </h2>
      <ul className="mt-2 grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
            <a href={`/api/attachments/${item.id}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/attachments/${item.id}`}
                alt={item.caption ?? `${title} รูปที่ ${index + 1}`}
                className="max-h-96 w-full bg-slate-900/5 object-contain"
              />
            </a>
            <p className="px-3 py-2 text-sm text-slate-600">
              {item.caption ?? `รูปที่ ${index + 1} (ไม่มีคำอธิบาย)`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
