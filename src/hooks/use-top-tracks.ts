import { useQuery } from "@tanstack/react-query";
import type { TimeRange } from "@/types";
import type { TopTracksResponse } from "@/app/api/spotify/top-tracks/route";

async function fetchTopTracks(range: TimeRange): Promise<TopTracksResponse> {
  const res = await fetch(`/api/spotify/top-tracks?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch top tracks");
  return res.json() as Promise<TopTracksResponse>;
}

export function useTopTracks(timeRange: TimeRange = "short_term") {
  return useQuery({
    queryKey: ["top-tracks", timeRange],
    queryFn: () => fetchTopTracks(timeRange),
  });
}
