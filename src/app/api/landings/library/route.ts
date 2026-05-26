import { NextResponse } from "next/server";
import { readLandingManifest } from "@/lib/landing/library";

/** List all landing videos in the location library. */
export async function GET() {
  const manifest = await readLandingManifest();
  return NextResponse.json(manifest);
}
