import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function LandingPage() {
  const session = await getSession();

  // Authenticated users go straight to their profile
  if (session.userId) {
    redirect("/profile");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="mb-2 font-serif text-5xl font-medium tracking-tight">sona</h1>
        <p className="text-muted-foreground">Understand your music.</p>
      </div>

      <a
        href="/api/auth/login"
        className="flex items-center gap-2 rounded-full bg-[#1ed760] px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
      >
        <SpotifyIcon />
        Connect with Spotify
      </a>
    </main>
  );
}

function SpotifyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 11-.277-1.215c3.809-.87 7.076-.495 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.13-9.965-1.166a.78.78 0 01-.46-1.489c3.632-1.102 8.147-.568 11.238 1.328a.78.78 0 01.256 1.07zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 11-.543-1.793c3.563-1.08 9.484-.87 13.22 1.327a.937.937 0 01-.06 1.623z" />
    </svg>
  );
}
