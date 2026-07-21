/**
 * Emails that receive complimentary multiplayer / Online "subscribed" access
 * after email verification. Configure via ADMIN_SUBSCRIPTION_EMAILS
 * (comma-separated). Defaults include contact@planets.ooo.
 */
const DEFAULT_ADMIN_EMAILS = ["contact@planets.ooo"];

export function adminSubscriptionEmails(): Set<string> {
  const raw = process.env.ADMIN_SUBSCRIPTION_EMAILS?.trim();
  const list = raw
    ? raw.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ADMIN_EMAILS;
  return new Set(list);
}

export function isAdminSubscriptionEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminSubscriptionEmails().has(email.trim().toLowerCase());
}
