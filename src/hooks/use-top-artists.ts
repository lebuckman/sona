import { useQuery } from "@tanstack/react-query";
import type { TimeRange } from "@/types";
import type { TopArtistsResponse } from "@/app/api/spotify/top-artists/route";

async function fetchTopArtists(range: TimeRange): Promise<TopArtistsResponse> {
  const res = await fetch(`/api/spotify/top-artists?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch top artists");
  return res.json() as Promise<TopArtistsResponse>;
}

export function useTopArtists(timeRange: TimeRange = "short_term") {
  return useQuery({
    queryKey: ["top-artists", timeRange],
    queryFn: () => fetchTopArtists(timeRange),
  });
}
