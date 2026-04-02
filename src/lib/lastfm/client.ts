// Wrapper around the Last.fm Web API.
// Used exclusively for artist genre tags.

import type { LastFmTag, LastFmTagsResponse } from "@/types";

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

export async function fetchArtistTopTags(artistName: string): Promise<LastFmTag[]> {
  const params = new URLSearchParams({
    method: "artist.gettoptags",
    artist: artistName,
    api_key: process.env.LASTFM_API_KEY as string,
    format: "json",
    autocorrect: "1", // Last.fm will correct minor spelling differences
  });

  const response = await fetch(`${LASTFM_BASE}?${params.toString()}`, {
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    // Some artists aren't in Last.fm's database.
    // Return empty array and let the caller handle it gracefully.
    return [];
  }

  const data = (await response.json()) as LastFmTagsResponse | { error: number; message: string };

  // Last.fm returns a 200 with an error field for unknown artists
  if ("error" in data) {
    return [];
  }

  return data.toptags.tag ?? [];
}
