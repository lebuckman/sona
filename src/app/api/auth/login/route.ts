// Initiates the Spotify OAuth flow.
// Generates a random state value, stores it in the session, and redirects
// the user to Spotify's authorization page.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildSpotifyAuthUrl } from "@/lib/spotify/auth";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  // Generate a cryptographically random state value (CSRF protection).
  // Store in the session before redirecting, then verify it matches
  // what Spotify sends back in the callback.
  const state = randomBytes(16).toString("hex");
  session.oauthState = state;
  await session.save();

  const authUrl = buildSpotifyAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
