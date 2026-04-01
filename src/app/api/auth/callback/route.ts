// Handles the OAuth callback from Spotify.
// Validates state, exchanges code for tokens, upserts user record,
// encrypts and stores tokens, establishes session.

import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, tokens } from "@/lib/db/schema";
import { encryptToken } from "@/lib/crypto";
import { exchangeCodeForTokens, fetchSpotifyProfile } from "@/lib/spotify/auth";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL as string;
  const session = await getSession();

  // User denied access on Spotify's side
  if (error) {
    console.error("Spotify OAuth error:", error);
    return NextResponse.redirect(`${appUrl}/?error=access_denied`);
  }

  // Missing required params
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/?error=invalid_callback`);
  }

  // Validate state parameter to prevent CSRF
  if (state !== session.oauthState) {
    console.error("OAuth state mismatch — possible CSRF attempt");
    return NextResponse.redirect(`${appUrl}/?error=state_mismatch`);
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);

    // Fetch the user's Spotify profile
    const profile = await fetchSpotifyProfile(tokenResponse.access_token);

    // Upsert user record
    const [user] = await db
      .insert(users)
      .values({
        spotifyId: profile.id,
        displayName: profile.display_name,
        email: profile.email,
        avatarUrl: profile.images[0]?.url ?? null,
        country: profile.country,
        spotifyProduct: profile.product,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.spotifyId,
        set: {
          displayName: profile.display_name,
          email: profile.email,
          avatarUrl: profile.images[0]?.url ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!user) throw new Error("Failed to upsert user record");

    // Encrypt tokens and upsert token record
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    await db
      .insert(tokens)
      .values({
        userId: user.id,
        accessToken: encryptToken(tokenResponse.access_token),
        refreshToken: encryptToken(tokenResponse.refresh_token),
        expiresAt,
        scope: tokenResponse.scope,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: tokens.userId,
        set: {
          accessToken: encryptToken(tokenResponse.access_token),
          refreshToken: encryptToken(tokenResponse.refresh_token),
          expiresAt,
          scope: tokenResponse.scope,
          updatedAt: new Date(),
        },
      });

    // Establish session — clear oauth state, set user identity
    session.oauthState = undefined;
    session.userId = user.id;
    session.spotifyId = profile.id;
    session.displayName = profile.display_name;
    session.avatarUrl = profile.images[0]?.url;
    await session.save();

    // Redirect to the profile page
    return NextResponse.redirect(`${appUrl}/profile`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }
}
