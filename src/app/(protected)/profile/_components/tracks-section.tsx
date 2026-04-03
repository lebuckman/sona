"use client";

import { useState } from "react";
import Image from "next/image";
import { useTopTracks } from "@/hooks/use-top-tracks";
import { SectionLabel } from "@/components/layout/section-label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TimeRange } from "@/types";

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "4 Weeks", value: "short_term" },
  { label: "6 Months", value: "medium_term" },
  { label: "All Time", value: "long_term" },
];

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function TracksSection() {
  const [timeRange, setTimeRange] = useState<TimeRange>("short_term");
  const { data, isLoading } = useTopTracks(timeRange);

  const tracks = data?.tracks.slice(0, 10) ?? [];

  return (
    <section id="tracks" aria-labelledby="tracks-heading" className="py-16">
      <div className="mb-6">
        <SectionLabel className="mb-2">This Month</SectionLabel>
        <div className="flex items-end justify-between">
          <h2 id="tracks-heading" className="font-serif text-3xl font-medium tracking-tight">
            Top Tracks
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

      <div className="rounded-2xl border" role="list" aria-label="Top tracks">
        {isLoading
          ? [...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-4 last:border-b-0">
                <Skeleton className="size-10 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-10" />
              </div>
            ))
          : tracks.map((track, i) => (
              <a
                key={track.id}
                href={track.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                role="listitem"
                className="flex items-center gap-4 border-b p-4 transition-colors last:border-b-0 hover:bg-muted/30 focus:outline-none focus-visible:bg-muted/30"
                aria-label={`${track.name} by ${track.artists.map((a) => a.name).join(", ")}, ranked #${i + 1}`}
              >
                <span className="w-5 shrink-0 text-center text-sm text-muted-foreground/60 font-medium">
                  {i + 1}
                </span>
                <div className="relative size-10 shrink-0 overflow-hidden rounded-lg">
                  {track.album.imageUrl ? (
                    <Image
                      src={track.album.imageUrl}
                      alt={track.album.name}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted text-lg">
                      🎵
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{track.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {track.artists.map((a) => a.name).join(", ")}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDuration(track.durationMs)}
                </span>
              </a>
            ))}
      </div>
    </section>
  );
}
