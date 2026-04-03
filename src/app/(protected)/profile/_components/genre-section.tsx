"use client";

import { useGenreBreakdown } from "@/hooks/use-genre-breakdown";
import { useTopArtists } from "@/hooks/use-top-artists";
import { SectionLabel } from "@/components/layout/section-label";
import { Skeleton } from "@/components/ui/skeleton";

export function GenreSection() {
  // Fetch top artists first to warm the cache that genre breakdown depends on
  useTopArtists("short_term");
  const { data, isLoading } = useGenreBreakdown();

  const genres = data?.genres ?? [];

  return (
    <section id="sound" aria-labelledby="sound-heading" className="py-16">
      <SectionLabel className="mb-2">Sound DNA</SectionLabel>
      <h2 id="sound-heading" className="mb-6 font-serif text-3xl font-medium tracking-tight">
        Your Genre Fingerprint
      </h2>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3 w-24 shrink-0" />
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-3 w-8 shrink-0" />
            </div>
          ))}
        </div>
      ) : genres.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Genre data is loading — check back in a moment.
        </p>
      ) : (
        <div className="space-y-4" role="list" aria-label="Genre breakdown">
          {genres.map((entry) => (
            <div key={entry.genre} className="flex items-center gap-4" role="listitem">
              <span className="w-28 shrink-0 text-sm capitalize text-muted-foreground">
                {entry.genre}
              </span>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={entry.weight}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${entry.genre}: ${entry.weight}%`}
              >
                <div
                  className="h-full rounded-full bg-foreground/80 transition-all duration-700"
                  style={{ width: `${entry.weight}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {entry.weight}%
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
