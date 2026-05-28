"use client";

import dynamic from "next/dynamic";

const ExplorerView = dynamic(
  () => import("./ExplorerView").then((m) => m.ExplorerView),
  {
    ssr: false,
    loading: () => (
      <main className="relative h-screen w-full overflow-hidden bg-[#030508]" />
    ),
  },
);

export function ExplorerClient() {
  return <ExplorerView />;
}
