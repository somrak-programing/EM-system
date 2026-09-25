"use client";

import { useId, useRef, useState } from "react";
import { formatWhen } from "@/lib/format";
import { shiftDateTime, toDateTimeLocalValue, type DateTimeShift } from "@/lib/datetime";

type QuickPick = { label: string; shift: DateTimeShift };

export function DateTimeField({
  name,
  label,
  hint,
  required = false,
  quickPicks = [],
  initialValue = "",
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  quickPicks?: QuickPick[];
  initialValue?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  // showPicker() opens the native calendar from anywhere in the field, not just the tiny icon.
  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.showPicker?.();
  }

  function applyQuickPick(shift: DateTimeShift) {
    setValue(toDateTimeLocalValue(shiftDateTime(new Date(), shift)));
  }

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div
        className="group mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm transition focus-within:border-brand-teal focus-within:ring-4 focus-within:ring-brand-teal/15 hover:border-brand-teal/60"
        onClick={openPicker}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5 shrink-0 text-brand-navy/60 transition group-focus-within:text-brand-teal"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
        <input
          ref={inputRef}
          id={inputId}
          type="datetime-local"
          name={name}
          required={required}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-full border-0 bg-transparent p-0 text-sm text-slate-800 focus:ring-0"
        />
        {value ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setValue("");
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ล้าง
          </button>
        ) : null}
      </div>

      {quickPicks.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {quickPicks.map((pick) => (
            <button
              key={pick.label}
              type="button"
              onClick={() => applyQuickPick(pick.shift)}
              className="rounded-full border border-brand-navy/15 bg-brand-navy/5 px-3 py-1 text-xs font-medium text-brand-navy transition hover:border-brand-teal hover:bg-brand-teal/10 hover:text-brand-teal-dark"
            >
              {pick.label}
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-1 text-xs text-slate-500">
        {value ? formatWhen(value) : (hint ?? "ยังไม่ได้เลือก")}
      </p>
    </div>
  );
}
