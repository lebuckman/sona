import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co", // Spotify artist/album images
      },
      {
        protocol: "https",
        hostname: "image-cdn-ak.spotifycdn.com", // Spotify playlist images
      },
      {
        protocol: "https",
        hostname: "image-cdn-fa.spotifycdn.com", // Spotify playlist images
      },
      {
        protocol: "https",
        hostname: "mosaic.scdn.co", // Spotify mosaic playlist covers
      },
    ],
  },
};

export default nextConfig;
