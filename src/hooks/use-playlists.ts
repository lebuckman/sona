import { useQuery } from "@tanstack/react-query";
import type { PlaylistsResponse } from "@/app/api/spotify/playlists/route";

async function fetchPlaylists(): Promise<PlaylistsResponse> {
  const res = await fetch("/api/spotify/playlists");
  if (!res.ok) throw new Error("Failed to fetch playlists");
  return res.json() as Promise<PlaylistsResponse>;
}

export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: fetchPlaylists,
  });
}
