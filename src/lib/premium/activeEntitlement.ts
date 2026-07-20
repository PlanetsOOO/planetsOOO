import type { PremiumEntitlementPayload } from "@/lib/premium/entitlement";
import { getPremiumPurchaseByStripeSessionId } from "@/lib/entitlements/store";

/** True when the signed token matches the server’s current entitled install. */
export async function isPremiumEntitlementActive(
  payload: PremiumEntitlementPayload,
): Promise<boolean> {
  const purchase = await getPremiumPurchaseByStripeSessionId(payload.stripeSessionId);
  if (!purchase) return false;

  const activeInstallId = purchase.activeInstallId ?? purchase.installId;
  return (
    purchase.extensionId === payload.extensionId &&
    activeInstallId === payload.installId
  );
}
