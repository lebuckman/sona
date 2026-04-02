import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { withValidToken } from "@/lib/spotify/token";
import { fetchTopTracks } from "@/lib/spotify/client";
import { getCached, setCached, CACHE_TTL } from "@/lib/spotify/cache";
import type { TimeRange, SpotifyTrack } from "@/types";
import type { CacheKey } from "@/lib/spotify/cache";

export interface TopTracksResponse {
  tracks: {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    album: { id: string; name: string; imageUrl: string };
    durationMs: number;
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

  const cacheKey = `top_tracks:${timeRange}` as CacheKey;

  try {
    // Check cache first
    const cached = await getCached<TopTracksResponse["tracks"]>(session.userId, cacheKey);

    if (cached) {
      return NextResponse.json({
        tracks: cached,
        timeRange,
        cached: true,
      } satisfies TopTracksResponse);
    }

    // Cache miss — get a valid token and fetch from Spotify
    const accessToken = await withValidToken(session.userId);
    const response = await fetchTopTracks(accessToken, timeRange);

    // Transform — only keep fields that are actually needed
    const tracks = response.items.map((track: SpotifyTrack) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((a) => ({ id: a.id, name: a.name })),
      album: {
        id: track.album.id,
        name: track.album.name,
        imageUrl: track.album.images[0]?.url ?? "",
      },
      durationMs: track.duration_ms,
      spotifyUrl: track.external_urls.spotify,
    }));

    // Write to cache
    await setCached(session.userId, cacheKey, tracks, CACHE_TTL.TOP_TRACKS);

    return NextResponse.json({
      tracks,
      timeRange,
      cached: false,
    } satisfies TopTracksResponse);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SPOTIFY_UNAUTHORIZED") {
        return NextResponse.json({ error: "Spotify session expired" }, { status: 401 });
      }
      if (error.message.startsWith("SPOTIFY_RATE_LIMITED")) {
        return NextResponse.json({ error: "Rate limited by Spotify" }, { status: 429 });
      }
    }
    console.error("Top tracks error:", error);
    return NextResponse.json({ error: "Failed to fetch top tracks" }, { status: 500 });
  }
}
