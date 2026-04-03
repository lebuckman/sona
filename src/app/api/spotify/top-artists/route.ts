import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { withValidToken } from "@/lib/spotify/token";
import { fetchTopArtists } from "@/lib/spotify/client";
import { getCached, setCached, CACHE_TTL } from "@/lib/spotify/cache";
import type { SpotifyArtist, TimeRange } from "@/types";
import type { CacheKey } from "@/lib/spotify/cache";

export interface TopArtistsResponse {
  artists: {
    id: string;
    name: string;
    imageUrl: string;
    spotifyUrl: string;
  }[];
  timeRange: TimeRange;
  cached: boolean;
}

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeRange = (searchParams.get("range") ?? "short_term") as TimeRange;

  // Validate time range param
  const validRanges: TimeRange[] = ["short_term", "medium_term", "long_term"];
  if (!validRanges.includes(timeRange)) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }

  const cacheKey = `top_artists:${timeRange}` as CacheKey;

  try {
    // Check cache first
    const cached = await getCached<TopArtistsResponse["artists"]>(session.userId, cacheKey);

    if (cached) {
      return NextResponse.json({
        artists: cached,
        timeRange,
        cached: true,
      } satisfies TopArtistsResponse);
    }

    // Cache miss — get a valid token and fetch from Spotify
    const accessToken = await withValidToken(session.userId);
    const response = await fetchTopArtists(accessToken, timeRange);

    // Transform — only keep fields that are actually needed
    const artists = response.items.map((artist: SpotifyArtist) => ({
      id: artist.id,
      name: artist.name,
      imageUrl: artist.images[0]?.url ?? "",
      spotifyUrl: artist.external_urls.spotify,
    }));

    // Write to cache
    await setCached(session.userId, cacheKey, artists, CACHE_TTL.TOP_ARTISTS);

    return NextResponse.json({
      artists,
      timeRange,
      cached: false,
    } satisfies TopArtistsResponse);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SPOTIFY_UNAUTHORIZED") {
        return NextResponse.json({ error: "Spotify session expired" }, { status: 401 });
      }
      if (error.message.startsWith("SPOTIFY_RATE_LIMITED")) {
        return NextResponse.json({ error: "Rate limited by Spotify" }, { status: 429 });
      }
    }
    console.error("Top artists error:", error);
    return NextResponse.json({ error: "Failed to fetch top artists" }, { status: 500 });
  }
}
