"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isExtensionPackaged } from "@/lib/screensaverConfig";

export function ExtensionLinkAnchor() {
  const [href, setHref] = useState("/auth/extension");

  useEffect(() => {
    if (!isExtensionPackaged()) return;
    const chromeApi = (
      globalThis as typeof globalThis & {
        chrome?: {
          runtime?: { id?: string };
          storage?: { local?: { get: (keys: object) => Promise<Record<string, string>> } };
        };
      }
    ).chrome;
    void (async () => {
      const installId =
        (await chromeApi?.storage?.local?.get({ premiumInstallId: "" }))
          ?.premiumInstallId ?? "";
      const extensionId = chromeApi?.runtime?.id ?? "";
      const url = new URL("/auth/extension", window.location.origin);
      if (extensionId) url.searchParams.set("extensionId", extensionId);
      if (installId) url.searchParams.set("installId", installId);
      setHref(`${url.pathname}${url.search}`);
    })();
  }, []);

  return (
    <Link href={href} className="text-sky-200 hover:text-sky-100">
      Link extension
    </Link>
  );
}
