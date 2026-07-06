import { NextResponse } from "next/server";
import { CHROME_EXTENSION_ID_RE, UUID_RE } from "@/lib/premium/validation";
import {
  getWebSession,
  issueExtensionSessionToken,
} from "@/lib/multiplayer/access";
import { linkExtensionInstall } from "@/lib/entitlements/store";
import { getUserById } from "@/lib/entitlements/store";

export const runtime = "nodejs";

interface LinkBody {
  extensionId?: string;
  installId?: string;
}

export async function POST(request: Request) {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: LinkBody;
  try {
    body = (await request.json()) as LinkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const extensionId = body.extensionId?.trim() ?? "";
  const installId = body.installId?.trim() ?? "";
  if (!CHROME_EXTENSION_ID_RE.test(extensionId)) {
    return NextResponse.json({ error: "Invalid extension id." }, { status: 400 });
  }
  if (!UUID_RE.test(installId)) {
    return NextResponse.json({ error: "Invalid install id." }, { status: 400 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await linkExtensionInstall({
    extensionId,
    installId,
    userId: user.id,
    linkedAt: Date.now(),
  });

  const extensionSession = issueExtensionSessionToken({
    userId: user.id,
    email: user.email,
    extensionId,
    installId,
  });

  return NextResponse.json({
    ok: true,
    extensionSession,
    userId: user.id,
    email: user.email,
  });
}
