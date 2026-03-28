import type { SessionOptions } from "iron-session";

export interface SessionData {
  userId: string;
  spotifyId: string;
  displayName: string;
  avatarUrl?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "sona_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};
