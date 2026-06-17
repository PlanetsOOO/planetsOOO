"use client";

import { installThreeClockCompat } from "@/lib/threeClockCompat";
import { ExplorerView } from "./ExplorerView";

installThreeClockCompat();

export function ExplorerClient() {
  return <ExplorerView />;
}
