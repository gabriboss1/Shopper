import { DINING_HALLS } from "@/data/dining";
import { typicalCrowd, yaleNow, type YaleClock } from "@/lib/dining";
import type { CrowdLevel } from "@/data/dining";

export const dynamic = "force-dynamic";

const LIVE_KEYS = ["currentPopularity", "popularTimes", "liveBusyness"] as const;

type LiveReading = { id: string; level: CrowdLevel; label: string; percent: number };

let probed: { at: number; supported: boolean } | null = null;
let cache: { at: number; readings: LiveReading[] } | null = null;

function levelFromPercent(percent: number): CrowdLevel {
  if (percent < 25) return "Quiet";
  if (percent < 50) return "Moderate";
  if (percent < 75) return "Busy";
  return "Very busy";
}

function readPercent(place: Record<string, unknown>): number | null {
  for (const key of LIVE_KEYS) {
    const value = place[key];
    if (typeof value === "number" && value >= 0 && value <= 100) return value;
  }
  return null;
}

async function searchPlace(query: string, key: string, fieldMask: string): Promise<Response> {
  return fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify({ textQuery: query }),
    signal: AbortSignal.timeout(4000),
  });
}

async function officialLive(key: string): Promise<LiveReading[] | null> {
  const now = Date.now();
  if (cache && now - cache.at < 8 * 60 * 1000) return cache.readings;
  if (probed && !probed.supported && now - probed.at < 8 * 60 * 1000) return null;
  const probe = await searchPlace("Silliman College dining Yale University", key, "places.currentPopularity,places.popularTimes,places.liveBusyness");
  if (!probe.ok) {
    probed = { at: now, supported: false };
    return null;
  }
  probed = { at: now, supported: true };
  const readings: LiveReading[] = [];
  for (const hall of DINING_HALLS) {
    const response = await searchPlace(`${hall.name} Yale University New Haven`, key, "places.id,places.displayName,places.currentPopularity,places.popularTimes,places.liveBusyness");
    if (!response.ok) continue;
    const body = (await response.json()) as { places?: Record<string, unknown>[] };
    const percent = body.places?.[0] ? readPercent(body.places[0]) : null;
    if (percent === null) continue;
    readings.push({
      id: hall.id,
      level: levelFromPercent(percent),
      label: `Google live busyness ${percent}%`,
      percent,
    });
  }
  cache = { at: now, readings };
  return readings.length > 0 ? readings : null;
}

export async function GET() {
  const clock: YaleClock = yaleNow();
  const typical = DINING_HALLS.map((hall) => ({
    id: hall.id,
    level: typicalCrowd(hall.id, clock),
    label: "Typical for this time.",
    live: false as const,
  }));
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  if (!key) return Response.json({ readings: typical });
  try {
    const live = await officialLive(key);
    if (!live) return Response.json({ readings: typical });
    const byId = new Map(live.map((row) => [row.id, row]));
    return Response.json({
      readings: typical.map((row) => {
        const found = byId.get(row.id);
        return found ? { ...found, live: true as const } : row;
      }),
    });
  } catch {
    return Response.json({ readings: typical });
  }
}
