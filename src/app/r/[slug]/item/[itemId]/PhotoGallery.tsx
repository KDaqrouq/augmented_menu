"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/components/ui";
import { PhotoIcon } from "@/components/icons";

/** Swipeable, scroll-snapping photo gallery with position dots. */
export function PhotoGallery({ photos, alt }: { photos: { id: string; url: string }[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-brand-50 to-stone-100 text-stone-300 sm:rounded-3xl">
        <PhotoIcon size={48} />
      </div>
    );
  }

  function goTo(i: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="scrollbar-none flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto bg-stone-100 sm:rounded-3xl"
      >
        {photos.map((photo, i) => (
          <div key={photo.id} className="relative h-full w-full shrink-0 snap-center">
            <Image
              src={photo.url}
              alt={i === 0 ? alt : `${alt}, photo ${i + 1}`}
              fill
              priority={i === 0}
              sizes="(min-width: 672px) 672px, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full bg-white shadow transition-all",
                i === index ? "w-5 opacity-100" : "w-1.5 opacity-60"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
