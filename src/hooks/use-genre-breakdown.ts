import { useQuery } from "@tanstack/react-query";
import type { GenreBreakdownResponse } from "@/app/api/lastfm/genre-breakdown/route";

async function fetchGenreBreakdown(): Promise<GenreBreakdownResponse> {
  const res = await fetch("/api/lastfm/genre-breakdown");
  if (!res.ok) throw new Error("Failed to fetch genre breakdown");
  return res.json() as Promise<GenreBreakdownResponse>;
}

export function useGenreBreakdown() {
  return useQuery({
    queryKey: ["genre-breakdown"],
    queryFn: fetchGenreBreakdown,
    // Genre breakdown depends on top artists being cached first.
    // staleTime is longer since we cache this for 7 days server-side.
    staleTime: 1000 * 60 * 60 * 24, // 24 hours client-side
  });
}
