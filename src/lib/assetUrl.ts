/** Resolve `/textures/...` and `/data/...` paths for chrome-extension:// offline pages. */
export function assetUrl(path: string): string {
  if (!path.startsWith("/")) return path;
  if (typeof window === "undefined") return path;

  const chromeApi = (
    globalThis as typeof globalThis & {
      chrome?: { runtime?: { getURL?: (resourcePath: string) => string } };
    }
  ).chrome;

  if (
    window.location.protocol === "chrome-extension:" &&
    chromeApi?.runtime?.getURL
  ) {
    return chromeApi.runtime.getURL(path.slice(1));
  }

  return path;
}
