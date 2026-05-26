import { NextRequest, NextResponse } from "next/server";

const TERRARIUM =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";

/** Proxy Terrarium DEM tiles for landing descent displacement. */
export async function GET(request: NextRequest) {
  const z = request.nextUrl.searchParams.get("z");
  const x = request.nextUrl.searchParams.get("x");
  const y = request.nextUrl.searchParams.get("y");

  if (!z || !x || !y) {
    return NextResponse.json({ error: "Missing z, x, or y" }, { status: 400 });
  }

  const url = `${TERRARIUM}/${z}/${x}/${y}.png`;
  const upstream = await fetch(url, { next: { revalidate: 604_800 } });

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status });
  }

  const bytes = await upstream.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
    },
  });
}
