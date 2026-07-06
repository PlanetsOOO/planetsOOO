import { NextResponse } from "next/server";
import { listLeaderboard } from "@/lib/entitlements/store";

export const runtime = "nodejs";

export async function GET() {
  const entries = await listLeaderboard(20);
  return NextResponse.json({ entries });
}
