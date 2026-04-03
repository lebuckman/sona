// Wrapper around the Last.fm Web API.
// Used exclusively for artist genre tags.

import type { LastFmTag, LastFmTagsResponse } from "@/types";

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

export async function fetchArtistTopTags(artistName: string): Promise<LastFmTag[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    method: "artist.gettoptags",
    artist: artistName,
    api_key: apiKey,
    format: "json",
    autocorrect: "1", // Last.fm will correct minor spelling differences
  });

  try {
    const response = await fetch(`${LASTFM_BASE}?${params.toString()}`, {
      next: { revalidate: 0 },
    });
    // Some artists aren't in Last.fm's database.
    if (!response.ok) return [];

    const data = (await response.json()) as LastFmTagsResponse | { error: number; message: string };
    // Last.fm returns a 200 with an error field for unknown artists
    if (!data || typeof data !== "object" || "error" in data) return [];

    return data.toptags.tag ?? [];
  } catch {
    return [];
  }
}
