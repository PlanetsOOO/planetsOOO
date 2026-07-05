import Link from "next/link";

export function LegalFooter() {
  return (
    <p className="mt-10 text-center text-xs leading-6 text-zinc-600">
      <Link
        href="/privacy"
        className="text-zinc-500 underline underline-offset-2 hover:text-zinc-400"
      >
        Privacy policy
      </Link>
      <span className="mx-2 text-zinc-700">·</span>
      <Link
        href="/privacy#simulation-disclaimer"
        className="text-zinc-500 underline underline-offset-2 hover:text-zinc-400"
      >
        Simulation disclaimer
      </Link>
    </p>
  );
}
