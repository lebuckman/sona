import { getSession } from "@/lib/session";
import { ArtistsSection } from "./_components/artists-section";
import { TracksSection } from "./_components/tracks-section";
import { GenreSection } from "./_components/genre-section";
import { PlaylistsSection } from "./_components/playlists-section";
import { SectionLabel } from "@/components/layout/section-label";
import { SonaVoice } from "@/components/sona/sona-voice";

export default async function ProfilePage() {
  const session = await getSession();
  const ownerLabel = session.displayName ? `${session.displayName}'s` : "Your";

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <span className="font-serif text-lg font-medium tracking-tight">sona</span>
          <nav
            className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex"
            aria-label="Profile sections"
          >
            <a href="#artists" className="transition-colors hover:text-foreground">
              Artists
            </a>
            <a href="#sound" className="transition-colors hover:text-foreground">
              Sound
            </a>
            <a href="#tracks" className="transition-colors hover:text-foreground">
              Tracks
            </a>
            <a href="#playlists" className="transition-colors hover:text-foreground">
              Playlists
            </a>
          </nav>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        {/* Identity hero */}
        <section id="identity" aria-labelledby="identity-heading" className="py-16">
          <SectionLabel className="mb-3">Your Identity</SectionLabel>
          <h1
            id="identity-heading"
            className="mb-4 font-serif text-5xl font-medium italic tracking-tight sm:text-6xl"
          >
            {ownerLabel}
            <br />
            <span className="text-muted-foreground">music story.</span>
          </h1>
          <SonaVoice className="max-w-xl">
            This is what your listening looks like — your artists, your sound, your playlists. Sona
            reads between the lines so you don&apos;t have to.
          </SonaVoice>
        </section>

        <hr className="border-border" />
        <ArtistsSection />

        <hr className="border-border" />
        <GenreSection />

        <hr className="border-border" />
        <TracksSection />

        <hr className="border-border" />
        <PlaylistsSection />
      </main>
    </div>
  );
}
