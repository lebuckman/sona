// Cache utilities for Spotify data.
// Wraps the spotify_cache table with typed read/write helpers.
// Lazy Loading: check cache on read, populate on miss.

import { db } from "@/lib/db";
import { spotifyCache } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

export type CacheKey =
  | "top_tracks:short_term"
  | "top_tracks:medium_term"
  | "top_tracks:long_term"
  | "top_artists:short_term"
  | "top_artists:medium_term"
  | "top_artists:long_term"
  | "playlists"
  | "genre_breakdown";

// TTL constants in milliseconds
export const CACHE_TTL = {
  TOP_TRACKS: 60 * 60 * 1000, // 1 hour
  TOP_ARTISTS: 60 * 60 * 1000, // 1 hour
  PLAYLISTS: 30 * 60 * 1000, // 30 minutes
  GENRE_BREAKDOWN: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

/**
 * Reads a cache entry for a user. Returns null on miss or expiry.
 */
export async function getCached<T>(userId: string, cacheKey: CacheKey): Promise<T | null> {
  const entry = await db.query.spotifyCache.findFirst({
    where: and(
      eq(spotifyCache.userId, userId),
      eq(spotifyCache.cacheKey, cacheKey),
      gt(spotifyCache.expiresAt, new Date())
    ),
  });

  if (!entry) return null;
  return entry.data as T;
}

/**
 * Writes or overwrites a cache entry for a user.
 */
export async function setCached<T>(
  userId: string,
  cacheKey: CacheKey,
  data: T,
  ttlMs: number
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  await db
    .insert(spotifyCache)
    .values({
      userId,
      cacheKey,
      data: data as Record<string, unknown>,
      cachedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [spotifyCache.userId, spotifyCache.cacheKey],
      set: {
        data: data as Record<string, unknown>,
        cachedAt: now,
        expiresAt,
      },
    });
}
