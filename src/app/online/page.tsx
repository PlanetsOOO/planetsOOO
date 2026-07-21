import { redirect } from "next/navigation";
import Link from "next/link";
import { getWebSession } from "@/lib/multiplayer/access";
import { canAccessOnline } from "@/lib/online/access";

/**
 * Orbit Online entry — requires planets.ooo login, then enters the explorer
 * in Online demo mode (?online=1).
 */
export default async function OnlineEntryPage() {
  const session = await getWebSession();
  const access = await canAccessOnline({
    userId: session?.userId,
    email: session?.email,
  });

  if (!access.online) {
    redirect("/login?next=/online");
  }

  redirect("/?online=1");

  return (
    <main className="min-h-screen bg-[#030508] px-6 py-16 text-zinc-200">
      <Link href="/" className="text-xs uppercase tracking-[0.25em] text-zinc-600">
        ← Back to explorer
      </Link>
      <p className="mt-8 text-sm text-zinc-400">Entering Orbit Online…</p>
    </main>
  );
}
