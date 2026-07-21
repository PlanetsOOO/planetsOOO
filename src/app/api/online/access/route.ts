import { NextResponse } from "next/server";
import { getWebSession } from "@/lib/multiplayer/access";
import { canAccessOnline } from "@/lib/online/access";

export const runtime = "nodejs";

export async function GET() {
  const session = await getWebSession();
  const access = await canAccessOnline({
    userId: session?.userId,
    email: session?.email,
  });
  return NextResponse.json(access);
}
