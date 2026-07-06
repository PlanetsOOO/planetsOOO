import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/account/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#030508] px-6 py-16 text-zinc-200">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-xs uppercase tracking-[0.25em] text-zinc-600">
          ← Back to explorer
        </Link>
        <Suspense>
          <div className="mt-8">
            <LoginForm />
          </div>
        </Suspense>
      </div>
    </main>
  );
}
