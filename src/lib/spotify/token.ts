// withValidToken() — a proxy that handles token lookup,
// decryption, expiry check, and silent refresh.

import { db } from "@/lib/db";
import { tokens } from "@/lib/db/schema";
import { encryptToken, decryptToken } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/spotify/auth";
import { eq } from "drizzle-orm";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh if expiring within 5 minutes

/**
 * Returns a valid Spotify access token for the given user.
 * Automatically refreshes if the token is expiring soon.
 *
 * The token never leaves the server: it's looked up from the DB, decrypted
 * in memory, used for the API call, and the response is what gets sent to
 * the client.
 */
export async function withValidToken(userId: string): Promise<string> {
  // Look up token record for this user
  const tokenRecord = await db.query.tokens.findFirst({
    where: eq(tokens.userId, userId),
  });

  if (!tokenRecord) {
    throw new Error("No token record found — user must re-authenticate");
  }

  // Decrypt the stored access token
  const accessToken = decryptToken(tokenRecord.accessToken);
  const now = Date.now();
  const expiresAt = tokenRecord.expiresAt.getTime();

  // If token is still valid with comfortable margin, return it
  if (expiresAt - now > REFRESH_THRESHOLD_MS) {
    return accessToken;
  }

  // Token is expiring soon — refresh it.
  console.warn("Access token expiring soon, refreshing...");

  const refreshToken = decryptToken(tokenRecord.refreshToken);
  const refreshed = await refreshAccessToken(refreshToken);

  // Encrypt and persist the new access token
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await db
    .update(tokens)
    .set({
      accessToken: encryptToken(refreshed.access_token),
      expiresAt: newExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(tokens.userId, userId));

  return refreshed.access_token;
}
