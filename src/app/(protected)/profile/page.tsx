import { getSession } from "@/lib/session";

export default async function ProfilePage() {
  const session = await getSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Hey, {session.displayName ?? "there"} 👋</h1>
      <p className="text-muted-foreground">Successful Authentication.</p>
      <form action="/api/auth/logout" method="POST">
        <button
          type="submit"
          className="rounded-full bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
