"use client";

import { useState } from "react";

type Photo = { url: string; date: string };

/**
 * Side-by-side before/after compare. Pick any two dated progress photos to see
 * the change over time — a standard pro-app progress view. Defaults to the
 * oldest vs. the newest, the comparison people actually want.
 */
export function PhotoCompare({ photos }: { photos: Photo[] }) {
  const [beforeIdx, setBeforeIdx] = useState(0);
  const [afterIdx, setAfterIdx] = useState(photos.length - 1);

  if (photos.length < 2) {
    return null;
  }

  const before = photos[beforeIdx];
  const after = photos[afterIdx];

  return (
    <section>
      <h2 className="mb-1 font-medium text-lg">Before / after</h2>
      <p className="mb-4 text-muted-foreground text-sm">
        Pick two dates and see the change side by side.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <PickedPhoto
          label="Before"
          onChange={setBeforeIdx}
          photo={before}
          photos={photos}
          selectedIdx={beforeIdx}
        />
        <PickedPhoto
          label="After"
          onChange={setAfterIdx}
          photo={after}
          photos={photos}
          selectedIdx={afterIdx}
        />
      </div>
    </section>
  );
}

function PickedPhoto({
  label,
  photo,
  photos,
  selectedIdx,
  onChange,
}: {
  label: string;
  photo: Photo;
  photos: Photo[];
  selectedIdx: number;
  onChange: (idx: number) => void;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative">
        {/* biome-ignore lint/performance/noImgElement: user-uploaded blob images, sizes vary */}
        <img
          alt={`${label} — ${photo.date}`}
          className="aspect-square w-full object-cover"
          src={photo.url}
        />
        <span className="absolute top-2 left-2 rounded-full bg-background/80 px-2.5 py-0.5 font-medium text-xs backdrop-blur">
          {label}
        </span>
      </div>
      <figcaption className="px-3 py-2">
        <select
          aria-label={`${label} photo`}
          className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onChange={(e) => onChange(Number(e.target.value))}
          value={selectedIdx}
        >
          {photos.map((p, i) => (
            <option key={p.url} value={i}>
              {p.date}
            </option>
          ))}
        </select>
      </figcaption>
    </figure>
  );
}
