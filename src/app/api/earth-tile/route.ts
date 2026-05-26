import { NextRequest, NextResponse } from "next/server";

const EOX_TILE =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible";

/** Proxy Sentinel-2 cloudless tiles for landing descent stitching. */
export async function GET(request: NextRequest) {
  const z = request.nextUrl.searchParams.get("z");
  const x = request.nextUrl.searchParams.get("x");
  const y = request.nextUrl.searchParams.get("y");

  if (!z || !x || !y) {
    return NextResponse.json({ error: "Missing z, x, or y" }, { status: 400 });
  }

  const url = `${EOX_TILE}/${z}/${y}/${x}.jpg`;
  const upstream = await fetch(url, { next: { revalidate: 86_400 } });

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status });
  }

  const bytes = await upstream.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
