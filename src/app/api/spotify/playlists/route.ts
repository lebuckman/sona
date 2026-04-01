import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { withValidToken } from "@/lib/spotify/token";
import { fetchPlaylists } from "@/lib/spotify/client";
import { getCached, setCached, CACHE_TTL } from "@/lib/spotify/cache";
import type { SpotifyPlaylist } from "@/types";

export interface PlaylistsResponse {
  playlists: {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
    trackCount: number;
    spotifyUrl: string;
  }[];
  cached: boolean;
}

export async function GET() {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check cache first
    const cached = await getCached<PlaylistsResponse["playlists"]>(session.userId, "playlists");

    if (cached) {
      return NextResponse.json({ playlists: cached, cached: true } satisfies PlaylistsResponse);
    }

    // Cache miss — get a valid token and fetch from Spotify
    const accessToken = await withValidToken(session.userId);
    const response = await fetchPlaylists(accessToken);

    // Transform — only keep fields that are actually needed
    const playlists = response.items.map((playlist: SpotifyPlaylist) => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description ?? "",
      imageUrl: playlist.images[0]?.url ?? "",
      trackCount: playlist.tracks?.total ?? 0,
      spotifyUrl: playlist.external_urls.spotify,
    }));

    // Write to cache
    await setCached(session.userId, "playlists", playlists, CACHE_TTL.PLAYLISTS);

    return NextResponse.json({ playlists, cached: false } satisfies PlaylistsResponse);
  } catch (error) {
    if (error instanceof Error && error.message === "SPOTIFY_UNAUTHORIZED") {
      return NextResponse.json({ error: "Spotify session expired" }, { status: 401 });
    }
    console.error("Playlists error:", error);
    return NextResponse.json({ error: "Failed to fetch playlists" }, { status: 500 });
  }
}
