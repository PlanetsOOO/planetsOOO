import fs from "node:fs/promises";
import path from "node:path";
import type {
  EntitlementDatabase,
  ExtensionLinkRecord,
  OnlineProfileRecord,
  PlayerProgressionRecord,
  PremiumPurchaseRecord,
  SubscriptionRecord,
  UserRecord,
} from "@/lib/entitlements/types";
import { extensionLinkKey } from "@/lib/entitlements/types";

const EMPTY_DB: EntitlementDatabase = {
  users: {},
  premiumPurchases: {},
  subscriptions: {},
  extensionLinks: {},
  progression: {},
  onlineProfiles: {},
};

let writeChain: Promise<void> = Promise.resolve();

function dataFilePath(): string {
  const configured = process.env.ENTITLEMENT_DATA_PATH?.trim();
  if (configured) return configured;
  // Vercel serverless FS is read-only except /tmp (ephemeral per instance).
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "/tmp/planets-ooo-entitlements.json";
  }
  return path.join(process.cwd(), "data", "entitlements.json");
}

async function readDb(): Promise<EntitlementDatabase> {
  const filePath = dataFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as EntitlementDatabase;
    return {
      users: parsed.users ?? {},
      premiumPurchases: parsed.premiumPurchases ?? {},
      subscriptions: parsed.subscriptions ?? {},
      extensionLinks: parsed.extensionLinks ?? {},
      progression: parsed.progression ?? {},
      onlineProfiles: parsed.onlineProfiles ?? {},
    };
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

async function writeDb(db: EntitlementDatabase): Promise<void> {
  const filePath = dataFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(db, null, 2), "utf8");
}

async function mutateDb(
  mutator: (db: EntitlementDatabase) => void,
): Promise<EntitlementDatabase> {
  let result!: EntitlementDatabase;
  writeChain = writeChain.then(async () => {
    const db = await readDb();
    mutator(db);
    await writeDb(db);
    result = db;
  });
  await writeChain;
  return result;
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const db = await readDb();
  return db.users[userId] ?? null;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  const db = await readDb();
  return (
    Object.values(db.users).find((user) => user.email === normalized) ?? null
  );
}

export async function listUsers(): Promise<UserRecord[]> {
  const db = await readDb();
  return Object.values(db.users);
}

export async function createUser(record: UserRecord): Promise<UserRecord> {
  await mutateDb((db) => {
    db.users[record.id] = record;
  });
  return record;
}

export async function updateUser(
  userId: string,
  patch: Partial<UserRecord>,
): Promise<UserRecord | null> {
  let updated: UserRecord | null = null;
  await mutateDb((db) => {
    const existing = db.users[userId];
    if (!existing) return;
    updated = { ...existing, ...patch };
    db.users[userId] = updated;
  });
  return updated;
}

export async function registerPremiumPurchase(
  record: PremiumPurchaseRecord,
): Promise<void> {
  await mutateDb((db) => {
    db.premiumPurchases[record.stripeSessionId] = {
      ...record,
      activeInstallId: record.activeInstallId ?? record.installId,
    };
  });
}

export async function getPremiumPurchaseByStripeSessionId(
  stripeSessionId: string,
): Promise<PremiumPurchaseRecord | null> {
  const db = await readDb();
  return db.premiumPurchases[stripeSessionId] ?? null;
}

export async function getPremiumPurchaseByGaiaId(
  extensionId: string,
  chromeGaiaId: string,
): Promise<PremiumPurchaseRecord | null> {
  const db = await readDb();
  return (
    Object.values(db.premiumPurchases).find(
      (purchase) =>
        purchase.extensionId === extensionId &&
        purchase.chromeGaiaId === chromeGaiaId,
    ) ?? null
  );
}

export async function updatePremiumActiveInstall(
  stripeSessionId: string,
  activeInstallId: string,
): Promise<PremiumPurchaseRecord | null> {
  let updated: PremiumPurchaseRecord | null = null;
  await mutateDb((db) => {
    const purchase = db.premiumPurchases[stripeSessionId];
    if (!purchase) return;
    updated = { ...purchase, activeInstallId };
    db.premiumPurchases[stripeSessionId] = updated;
  });
  return updated;
}

export async function linkPremiumPurchaseToUser(
  stripeSessionId: string,
  userId: string,
): Promise<void> {
  await mutateDb((db) => {
    const purchase = db.premiumPurchases[stripeSessionId];
    if (purchase) purchase.userId = userId;
  });
}

export async function getPremiumPurchaseByInstall(
  extensionId: string,
  installId: string,
): Promise<PremiumPurchaseRecord | null> {
  const db = await readDb();
  return (
    Object.values(db.premiumPurchases).find((purchase) => {
      if (purchase.extensionId !== extensionId) return false;
      const active = purchase.activeInstallId ?? purchase.installId;
      return active === installId || purchase.installId === installId;
    }) ?? null
  );
}

export async function upsertSubscription(record: SubscriptionRecord): Promise<void> {
  await mutateDb((db) => {
    db.subscriptions[record.stripeSubscriptionId] = record;
  });
}

export async function getActiveSubscriptionForUser(
  userId: string,
): Promise<SubscriptionRecord | null> {
  const db = await readDb();
  const matches = Object.values(db.subscriptions).filter(
    (sub) => sub.userId === userId,
  );
  matches.sort((a, b) => b.updatedAt - a.updatedAt);
  return matches[0] ?? null;
}

export async function linkExtensionInstall(
  record: ExtensionLinkRecord,
): Promise<void> {
  await mutateDb((db) => {
    db.extensionLinks[extensionLinkKey(record.extensionId, record.installId)] =
      record;
  });
}

export async function getExtensionLink(
  extensionId: string,
  installId: string,
): Promise<ExtensionLinkRecord | null> {
  const db = await readDb();
  return db.extensionLinks[extensionLinkKey(extensionId, installId)] ?? null;
}

export async function getOrCreateProgression(
  userId: string,
  displayName: string,
): Promise<PlayerProgressionRecord> {
  let result!: PlayerProgressionRecord;
  await mutateDb((db) => {
    const existing = db.progression[userId];
    if (existing) {
      result = existing;
      return;
    }
    result = {
      userId,
      displayName,
      discoveries: 0,
      roomJoins: 0,
      achievements: [],
      updatedAt: Date.now(),
    };
    db.progression[userId] = result;
  });
  return result;
}

export async function updateProgression(
  userId: string,
  patch: Partial<PlayerProgressionRecord>,
): Promise<PlayerProgressionRecord | null> {
  let updated: PlayerProgressionRecord | null = null;
  await mutateDb((db) => {
    const existing = db.progression[userId];
    if (!existing) return;
    updated = { ...existing, ...patch, updatedAt: Date.now() };
    db.progression[userId] = updated;
  });
  return updated;
}

export async function listLeaderboard(limit = 10): Promise<PlayerProgressionRecord[]> {
  const db = await readDb();
  return Object.values(db.progression)
    .sort((a, b) => b.discoveries - a.discoveries || b.roomJoins - a.roomJoins)
    .slice(0, limit);
}

export async function getOnlineProfile(
  userId: string,
): Promise<OnlineProfileRecord | null> {
  const db = await readDb();
  return db.onlineProfiles[userId] ?? null;
}

export async function upsertOnlineProfile(
  record: OnlineProfileRecord,
): Promise<OnlineProfileRecord> {
  await mutateDb((db) => {
    db.onlineProfiles[record.userId] = record;
  });
  return record;
}
