"use client";

import { useState } from "react";
import Image from "next/image";
import { useTopArtists } from "@/hooks/use-top-artists";
import { SectionLabel } from "@/components/layout/section-label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TimeRange } from "@/types";

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "4 Weeks", value: "short_term" },
  { label: "6 Months", value: "medium_term" },
  { label: "All Time", value: "long_term" },
];

export function ArtistsSection() {
  const [timeRange, setTimeRange] = useState<TimeRange>("short_term");
  const { data, isLoading } = useTopArtists(timeRange);

  const topThree = data?.artists.slice(0, 3) ?? [];
  const rest = data?.artists.slice(3, 9) ?? [];

  return (
    <section id="artists" aria-labelledby="artists-heading" className="py-16">
      <div className="mb-6">
        <SectionLabel className="mb-2">Defining Voices</SectionLabel>
        <div className="flex items-end justify-between">
          <h2 id="artists-heading" className="font-serif text-3xl font-medium tracking-tight">
            Top Artists
          </h2>
          <div
            className="flex gap-1 rounded-full border bg-muted/30 p-1"
            role="group"
            aria-label="Time range"
          >
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setTimeRange(r.value)}
                aria-pressed={timeRange === r.value}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all",
                  timeRange === r.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 3 editorial grid */}
      {isLoading ? (
        <div className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-none" />
          ))}
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border bg-border">
          {topThree.map((artist, i) => (
            <a
              key={artist.id}
              href={artist.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden bg-muted transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${artist.name} — ranked #${i + 1}`}
            >
              {artist.imageUrl ? (
                <Image
                  src={artist.imageUrl}
                  alt={artist.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 33vw, 280px"
                  loading={i === 0 ? "eager" : "lazy"}
                  priority={i === 0}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-muted text-4xl">🎵</div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 p-4">
                <p className="text-xs font-semibold text-white/60">#{i + 1}</p>
                <p className="font-serif text-lg font-medium text-white">{artist.name}</p>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Remaining artists list */}
      {!isLoading && rest.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rest.map((artist, i) => (
            <a
              key={artist.id}
              href={artist.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={artist.name}
            >
              <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
                {artist.imageUrl ? (
                  <Image
                    src={artist.imageUrl}
                    alt={artist.name}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted text-lg">🎵</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{artist.name}</p>
                <p className="text-xs text-muted-foreground">#{i + 4}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
