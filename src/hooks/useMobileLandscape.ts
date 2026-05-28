"use client";

import { useEffect, useState } from "react";

const QUERY =
  "(orientation: landscape) and (pointer: coarse) and (max-width: 1024px)";

export function useMobileLandscape(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setActive(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return active;
}
