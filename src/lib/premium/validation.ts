export const CHROME_EXTENSION_ID_RE = /^[a-p]{32}$/;
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Primary Chrome profile GAIA id from Google tokeninfo / getProfileUserInfo().id */
export const CHROME_GAIA_ID_RE = /^\d{10,21}$/;
