// Genre tag processing for Last.fm artist tags.
// Remove common noise, then pass through to Claude
// for intelligent interpretation.

import type { LastFmTag, GenreEntry } from "@/types";

// Non-exhaustive list of common non-genre tags
const NON_GENRE_BLOCKLIST = new Set([
  "seen live",
  "favorites",
  "favorite",
  "love",
  "like",
  "my profile",
  "under 2000 listeners",
  "all",
]);

// Minimum tag count threshold — filters out personal or one-off tags
// that haven't been applied by enough Last.fm users to be meaningful.
const MIN_TAG_COUNT = 5;

// Normalize common variants of popular genres (non-exhaustive).
// Unmapped variants will be interpreted correctly by Claude downstream.
const TAG_NORMALIZATIONS: Record<string, string> = {
  kpop: "k-pop",
  "korean pop": "k-pop",
  "k pop": "k-pop",
  jpop: "j-pop",
  "japanese pop": "j-pop",
  "j pop": "j-pop",
  jrock: "j-rock",
  "j rock": "j-rock",
  cpop: "c-pop",
  "chinese pop": "c-pop",
  mandopop: "c-pop",
  "thai pop": "thai",
  "t-pop": "thai",
  tpop: "thai",
  thailand: "thai",
  rnb: "r&b",
  "rhythm and blues": "r&b",
  hiphop: "hip hop",
  "hip-hop": "hip hop",
  "electronic music": "electronic",
};

function normalizeTag(tag: string): string {
  const lower = tag.toLowerCase().trim();
  return TAG_NORMALIZATIONS[lower] ?? lower;
}

function isValidTag(tag: string, count: number): boolean {
  if (count < MIN_TAG_COUNT) return false;
  const lower = tag.toLowerCase().trim();
  if (NON_GENRE_BLOCKLIST.has(lower)) return false;
  if (lower.length < 3) return false;
  if (/^\d{4}$/.test(lower)) return false;
  return true;
}

/**
 * Aggregates Last.fm tags across multiple artists into a weighted genre breakdown.
 *
 * Weighting strategy:
 * - Artist rank weight: rank #1 contributes more than rank #20, regardless
 *   of how famous the artist is on Last.fm
 * - Within-artist normalization: tag counts are normalized relative to that
 *   artist's own highest tag — this removes Last.fm popularity bias so a
 *   small indie artist contributes equally to a major label act at the same rank
 * - Artist name exclusion: dynamically filters out tags that match queried
 *   artist names
 *
 * Output is raw input for Claude, not a final UI-ready classification.
 * Claude interprets the tags in context and surfaces meaningful patterns in natural language.
 */
export function aggregateGenres(
  artistTags: { artistRank: number; artistName: string; tags: LastFmTag[] }[],
  topN = 8
): GenreEntry[] {
  const genreWeights = new Map<string, number>();

  // Build a set of artist names to exclude dynamically
  const artistNameSet = new Set(artistTags.map((a) => a.artistName.toLowerCase().trim()));

  for (const { artistRank, tags } of artistTags) {
    const relevantTags = tags
      .filter((t) => {
        const normalized = normalizeTag(t.name);
        if (artistNameSet.has(normalized)) return false;
        if (artistNameSet.has(t.name.toLowerCase().trim())) return false;
        return isValidTag(t.name, t.count);
      })
      .slice(0, 5); // top 5 tags per artist is sufficient signal

    if (relevantTags.length === 0) continue;

    // Rank 1 = weight 50, rank 20 = weight 31, rank 50 = weight 1
    const artistWeight = Math.max(1, 51 - artistRank);

    // Normalize within this artist so tag relevance is relative to
    // their own profile, not their absolute Last.fm popularity
    const maxCount = relevantTags[0]?.count ?? 1;

    for (const tag of relevantTags) {
      const normalized = normalizeTag(tag.name);
      const normalizedTagScore = tag.count / maxCount;
      const contribution = normalizedTagScore * artistWeight;
      genreWeights.set(normalized, (genreWeights.get(normalized) ?? 0) + contribution);
    }
  }

  const sorted = [...genreWeights.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);

  const maxWeight = sorted[0]?.[1] ?? 1;

  return sorted.map(([genre, weight]) => ({
    genre,
    weight: Math.round((weight / maxWeight) * 100),
  }));
}
