"use client";

import Image from "next/image";
import { usePlaylists } from "@/hooks/use-playlists";
import { SectionLabel } from "@/components/layout/section-label";
import { Skeleton } from "@/components/ui/skeleton";

export function PlaylistsSection() {
  const { data, isLoading } = usePlaylists();
  const playlists = data?.playlists.slice(0, 6) ?? [];

  return (
    <section id="playlists" aria-labelledby="playlists-heading" className="py-16">
      <SectionLabel className="mb-2">Your Collections</SectionLabel>
      <h2 id="playlists-heading" className="mb-6 font-serif text-3xl font-medium tracking-tight">
        Playlists
      </h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {isLoading
          ? [...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          : playlists.map((playlist) => (
              <a
                key={playlist.id}
                href={playlist.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border bg-muted/20 p-3 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${playlist.name} — ${playlist.trackCount} tracks`}
              >
                <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg">
                  {playlist.imageUrl ? (
                    <Image
                      src={playlist.imageUrl}
                      alt={playlist.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted text-4xl">
                      🎵
                    </div>
                  )}
                </div>
                <p className="truncate font-serif text-sm font-medium">{playlist.name}</p>
                <p className="text-xs text-muted-foreground">{playlist.trackCount} tracks</p>
              </a>
            ))}
      </div>
    </section>
  );
}
