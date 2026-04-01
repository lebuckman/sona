// Auth guard for all protected routes (/profile, /chat).
// Runs on the server before any child page renders.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // If not authenticated, redirect to landing page
  if (!session.userId) {
    redirect("/");
  }

  return <>{children}</>;
}
