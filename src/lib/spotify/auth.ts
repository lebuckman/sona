// Builds the Spotify authorization URL and exchanges codes for tokens.
// All OAuth logic lives here to be called by API routes.

import type { SpotifyTokenResponse, SpotifyUserProfile } from "@/types";

const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com";

// The scopes we request
export const SPOTIFY_SCOPES = [
  "user-top-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-email",
  "user-read-private",
].join(" ");

/**
 * Builds the Spotify OAuth authorization URL.
 * The state parameter is a random string we generate, store in the session,
 * and verify on callback (prevents CSRF attacks).
 */
export function buildSpotifyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID as string,
    scope: SPOTIFY_SCOPES,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI as string,
    state,
  });

  return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchanges an authorization code for access + refresh tokens.
 * Called once after the user approves access on Spotify's side.
 *
 * The authorization code is short-lived (10 minutes) and single-use.
 * Exchange it server-side so the client secret never touches the browser.
 */
export async function exchangeCodeForTokens(code: string) {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI as string,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json() as Promise<SpotifyTokenResponse>;
}

/**
 * Uses the refresh token to get a new access token.
 * Called by withValidToken() when the access token is expiring.
 *
 * Token Rotation: Access tokens are short-lived (1 hour) so if one is stolen, it
 * expires quickly. Refresh tokens are long-lived but only usable server-side.
 */
export async function refreshAccessToken(refreshToken: string) {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json() as Promise<Omit<SpotifyTokenResponse, "refresh_token">>;
}

/**
 * Fetches the authenticated user's Spotify profile.
 * Called once during the OAuth callback to create/update the user record.
 */
export async function fetchSpotifyProfile(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Spotify profile: ${response.status}`);
  }

  return response.json() as Promise<SpotifyUserProfile>;
}
