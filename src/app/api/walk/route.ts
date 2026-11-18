import { BUILDINGS, type BuildingId } from "@/data/courses";
import { walkingMinutes } from "@/lib/schedule";

export const dynamic = "force-dynamic";

type Pair = { from: BuildingId; to: BuildingId };

function isBuilding(value: unknown): value is BuildingId {
  return typeof value === "string" && value in BUILDINGS;
}

async function googleMinutes(from: BuildingId, to: BuildingId, key: string): Promise<number | null> {
  const origin = BUILDINGS[from];
  const destination = BUILDINGS[to];
  try {
    const routed = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: "WALK",
      }),
    });
    if (routed.ok) {
      const body = (await routed.json()) as { routes?: { duration?: string }[] };
      const seconds = Number(body.routes?.[0]?.duration?.replace("s", ""));
      if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, Math.round(seconds / 60));
    }
  } catch {
    /* try Directions next */
  }
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
    url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
    url.searchParams.set("mode", "walking");
    url.searchParams.set("key", key);
    const directed = await fetch(url);
    if (!directed.ok) return null;
    const body = (await directed.json()) as { routes?: { legs?: { duration?: { value?: number } }[] }[] };
    const seconds = body.routes?.[0]?.legs?.[0]?.duration?.value;
    if (typeof seconds === "number") return Math.max(1, Math.round(seconds / 60));
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { pairs?: Pair[] } | null;
  const pairs = (body?.pairs ?? []).filter((pair) => isBuilding(pair?.from) && isBuilding(pair?.to)).slice(0, 40);
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const walks = [];
  for (const pair of pairs) {
    if (pair.from === pair.to) {
      walks.push({ from: pair.from, to: pair.to, minutes: 0, source: "coordinate" as const });
      continue;
    }
    const google = key ? await googleMinutes(pair.from, pair.to, key) : null;
    if (google !== null) {
      walks.push({ from: pair.from, to: pair.to, minutes: google, source: "google" as const });
    } else {
      walks.push({ from: pair.from, to: pair.to, minutes: walkingMinutes(pair.from, pair.to), source: "coordinate" as const });
    }
  }
  return Response.json({ walks });
}
