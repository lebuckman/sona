// Spotify data types
export type TimeRange = "short_term" | "medium_term" | "long_term";

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: { url: string }[] };
  duration_ms: number;
  external_urls: { spotify: string };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string }[];
  external_urls: { spotify: string };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  items: { href: string; total: number } | null;
  external_urls: { spotify: string };
}

export interface LastFmTag {
  name: string;
  count: number;
  url: string;
}

export interface LastFmTagsResponse {
  toptags: {
    tag: LastFmTag[];
    "@attr": { artist: string };
  };
}

export interface GenreEntry {
  genre: string;
  weight: number;
}

// AI context — the data package passed to Claude
export interface SonaUserContext {
  displayName: string;
  topTracks: {
    name: string;
    artist: string;
    durationMs: number;
  }[];
  topArtists: {
    name: string;
  }[];
  topArtistsAllTime: {
    name: string;
  }[];
  // Derived from Last.fm artist.getTopTags
  genreBreakdown: GenreEntry[];
}

// API response wrappers
export interface ApiResponse<T> {
  data: T;
  cached: boolean;
  cachedAt?: string;
}

export interface ApiError {
  error: string;
  code: string;
}

// Spotify OAuth token response
export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
}

// Spotify user profile response
export interface SpotifyUserProfile {
  id: string;
  display_name: string;
  email: string;
  images: { url: string; height: number; width: number }[];
  country: string;
  product: string;
  external_urls: { spotify: string };
}
