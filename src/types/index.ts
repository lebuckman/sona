// Spotify data types
export type TimeRange = 'short_term' | 'medium_term' | 'long_term'

export interface SpotifyTrack {
  id: string
  name: string
  artists: { id: string; name: string }[]
  album: { id: string; name: string; images: { url: string }[] }
  duration_ms: number
  external_urls: { spotify: string }
}

export interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  images: { url: string }[]
  popularity: number
  external_urls: { spotify: string }
}

export interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  images: { url: string }[]
  tracks: { total: number }
  external_urls: { spotify: string }
}

export interface AudioFeatures {
  id: string
  energy: number
  danceability: number
  valence: number
  acousticness: number
  instrumentalness: number
  tempo: number
  loudness: number
  speechiness: number
}

// AI context — the data package passed to Claude
export interface SonaUserContext {
  displayName: string
  topTracks: {
    name: string
    artist: string
    durationMs: number
  }[]
  topArtists: {
    name: string
    genres: string[]
  }[]
  topArtistsAllTime: {
    name: string
  }[]
  genreBreakdown: {
    genre: string
    weight: number
  }[]
  audioFeatureAverages: {
    energy: number
    danceability: number
    valence: number
    acousticness: number
    instrumentalness: number
    tempo: number
    loudness: number
  }
}

// API response wrappers
export interface ApiResponse<T> {
  data: T
  cached: boolean
  cachedAt?: string
}

export interface ApiError {
  error: string
  code: string
}
