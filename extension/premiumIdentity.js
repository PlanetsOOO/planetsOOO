/** Shared Premium install + Chrome profile identity helpers. */

async function getPremiumInstallId() {
  const stored = await chrome.storage.local.get({ premiumInstallId: "" });
  if (stored.premiumInstallId) return stored.premiumInstallId;
  const installId = crypto.randomUUID();
  await chrome.storage.local.set({ premiumInstallId: installId });
  return installId;
}

function getChromeGaiaId() {
  return new Promise((resolve) => {
    if (!chrome.identity?.getProfileUserInfo) {
      resolve("");
      return;
    }
    chrome.identity.getProfileUserInfo({ accountStatus: "ANY" }, (info) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve("");
        return;
      }
      resolve(typeof info?.id === "string" ? info.id.trim() : "");
    });
  });
}

function getChromeAccessToken(interactive) {
  return new Promise((resolve) => {
    if (!chrome.identity?.getAuthToken) {
      resolve("");
      return;
    }
    chrome.identity.getAuthToken({ interactive: Boolean(interactive) }, (token) => {
      const err = chrome.runtime.lastError;
      if (err || !token) {
        resolve("");
        return;
      }
      resolve(token);
    });
  });
}

/**
 * @param {boolean} [interactive=false] If true, may show Google consent UI.
 *   Use only from an explicit user action (e.g. "Restore Premium").
 */
async function getChromeAccessTokenForRestore(interactive = false) {
  if (interactive) {
    const silent = await getChromeAccessToken(false);
    if (silent) return silent;
    return getChromeAccessToken(true);
  }
  return getChromeAccessToken(false);
}
