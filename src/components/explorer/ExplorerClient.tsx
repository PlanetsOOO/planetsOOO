"use client";

import { useEffect, useLayoutEffect } from "react";
import { installThreeClockCompat } from "@/lib/threeClockCompat";
import { activateScreensaverPresentation } from "@/lib/screensaverPresentation";
import { isScreensaverMode } from "@/lib/screensaverConfig";
import { ExplorerView } from "./ExplorerView";

export function ExplorerClient() {
  useLayoutEffect(() => {
    if (!isScreensaverMode()) return;
    return activateScreensaverPresentation();
  }, []);

  useEffect(() => {
    installThreeClockCompat();
  }, []);

  return <ExplorerView />;
}
