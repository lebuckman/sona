// Wrapper around the Spotify Web API.
// All functions take an access token and return typed responses.
// Token management (refresh, encryption) is handled by withValidToken()
// before these functions are ever called.

import type {
  SpotifyTrack,
  SpotifyArtist,
  AudioFeatures,
  SpotifyPlaylist,
  TimeRange,
} from "@/types";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

async function spotifyFetch<T>(endpoint: string, accessToken: string): Promise<T> {
  const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Tell Next.js to not cache this fetch — handled in the DB layer.
    next: { revalidate: 0 },
  });

  if (response.status === 401) {
    throw new Error("SPOTIFY_UNAUTHORIZED");
  }

  if (response.status === 429) {
    // Explicitly return the retry time in the error message for clearer
    // debugging. If the header is missing, default to 1 second.
    const retryAfter = response.headers.get("Retry-After");
    throw new Error(`SPOTIFY_RATE_LIMITED:${retryAfter ?? "1"}`);
  }

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status} ${endpoint}`);
  }

  return response.json() as Promise<T>;
}

// ── Top Tracks ──────────────────────────────────────────────────────────────

interface SpotifyTopTracksResponse {
  items: SpotifyTrack[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchTopTracks(accessToken: string, timeRange: TimeRange, limit = 50) {
  return spotifyFetch<SpotifyTopTracksResponse>(
    `/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
    accessToken
  );
}

// ── Top Artists ──────────────────────────────────────────────────────────────

interface SpotifyTopArtistsResponse {
  items: SpotifyArtist[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchTopArtists(accessToken: string, timeRange: TimeRange, limit = 50) {
  return spotifyFetch<SpotifyTopArtistsResponse>(
    `/me/top/artists?time_range=${timeRange}&limit=${limit}`,
    accessToken
  );
}

// ── Audio Features ───────────────────────────────────────────────────────────

interface SpotifyAudioFeaturesResponse {
  audio_features: AudioFeatures[];
}

export async function fetchAudioFeatures(accessToken: string, trackIds: string[]) {
  return spotifyFetch<SpotifyAudioFeaturesResponse>(
    `/audio-features?ids=${trackIds.join(",")}`,
    accessToken
  );
}

// ── Playlists ────────────────────────────────────────────────────────────────

interface SpotifyPlaylistsResponse {
  items: SpotifyPlaylist[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchPlaylists(accessToken: string, limit = 20) {
  return spotifyFetch<SpotifyPlaylistsResponse>(`/me/playlists?limit=${limit}`, accessToken);
}
