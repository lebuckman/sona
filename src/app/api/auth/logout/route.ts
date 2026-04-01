import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();

  // Overwrite the cookie with an empty, immediately-expired value.
  // The encrypted tokens remain in the DB so the user doesn't have to
  // re-authorize on next login — withValidToken() will refresh them.
  session.destroy();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL as string;

  // Redirect to landing page after logout.
  // NextResponse.redirect ensures the response is sent after
  // session.destroy() completes.
  return NextResponse.redirect(`${appUrl}/`);
}
