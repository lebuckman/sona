// Derives a weighted genre breakdown for the user by:
// 1. Reading their cached top artists (depends on top_artists:short_term cache)
// 2. Fetching Last.fm tags for each artist name
// 3. Aggregating and weighting tags into a genre profile

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCached, setCached, CACHE_TTL } from "@/lib/spotify/cache";
import { fetchArtistTopTags } from "@/lib/lastfm/client";
import { aggregateGenres } from "@/lib/lastfm/genres";
import type { GenreEntry, LastFmTag } from "@/types";

export interface GenreBreakdownResponse {
  genres: GenreEntry[];
  cached: boolean;
}

export async function GET() {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check genre breakdown cache first (24hr TTL)
    const cached = await getCached<GenreEntry[]>(session.userId, "genre_breakdown");
    if (cached) {
      return NextResponse.json({ genres: cached, cached: true } satisfies GenreBreakdownResponse);
    }

    // Read top artists from existing cache
    // If top artists haven't been fetched yet, return an empty
    // result and let the client retry after they load.
    type CachedArtist = { id: string; name: string; imageUrl: string; spotifyUrl: string };
    const cachedArtists = await getCached<CachedArtist[]>(session.userId, "top_artists:short_term");

    if (!cachedArtists || cachedArtists.length === 0) {
      return NextResponse.json({ genres: [], cached: false } satisfies GenreBreakdownResponse);
    }

    // Fetch Last.fm tags for each artist
    const artistsToQuery = cachedArtists.slice(0, 20);
    const artistTags: { artistRank: number; artistName: string; tags: LastFmTag[] }[] = [];

    for (let i = 0; i < artistsToQuery.length; i++) {
      const artist = artistsToQuery[i];
      if (!artist) continue;

      const tags = await fetchArtistTopTags(artist.name);
      artistTags.push({ artistRank: i + 1, artistName: artist.name, tags });

      // Small delay to avoid rate limiting (Last.fm terms)
      if (i < artistsToQuery.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Aggregate into weighted genre breakdown
    const genres = aggregateGenres(artistTags);

    // Cache the result for 24 hours
    await setCached(session.userId, "genre_breakdown", genres, CACHE_TTL.GENRE_BREAKDOWN);

    return NextResponse.json({ genres, cached: false } satisfies GenreBreakdownResponse);
  } catch (error) {
    console.error("Genre breakdown error:", error);
    return NextResponse.json({ error: "Failed to fetch genre breakdown" }, { status: 500 });
  }
}
