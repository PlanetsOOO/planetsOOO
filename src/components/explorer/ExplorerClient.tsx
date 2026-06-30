"use client";

import { useEffect } from "react";
import { installThreeClockCompat } from "@/lib/threeClockCompat";
import { ExplorerView } from "./ExplorerView";

export function ExplorerClient() {
  useEffect(() => {
    installThreeClockCompat();
  }, []);

  return <ExplorerView />;
}
