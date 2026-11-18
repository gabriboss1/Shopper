import { decryptString, encryptString } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { DAYS, type Day } from "@/data/courses";
import type { ManualEvent } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanEvents(value: unknown): ManualEvent[] | null {
  if (!Array.isArray(value) || value.length > 40) return null;
  const events: ManualEvent[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.slice(0, 40) : "";
    const title = typeof row.title === "string" ? row.title.trim().slice(0, 80) : "";
    const day = row.day as Day;
    const start = typeof row.start === "string" ? row.start : "";
    const end = typeof row.end === "string" ? row.end : "";
    if (!id || !title || !DAYS.includes(day) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) return null;
    events.push({ id, title, day, start, end });
  }
  return events;
}

export async function GET(request: Request) {
  const profileId = new URL(request.url).searchParams.get("profileId") ?? "";
  if (!UUID.test(profileId)) return Response.json({ events: [] }, { status: 400 });
  const rows = await sql<{ ciphertext: string; iv: string; tag: string }>(
    "select ciphertext, iv, tag from calendar_blobs where profile_id = $1",
    [profileId],
  );
  if (!rows[0]) return Response.json({ events: [] });
  try {
    const events = cleanEvents(JSON.parse(await decryptString(rows[0])));
    return Response.json({ events: events ?? [] });
  } catch {
    return Response.json({ events: [], error: "Stored calendar data could not be read." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { profileId?: unknown; events?: unknown } | null;
  const profileId = typeof body?.profileId === "string" ? body.profileId : "";
  if (!UUID.test(profileId)) return Response.json({ error: "Missing profile." }, { status: 400 });
  const events = cleanEvents(body?.events);
  if (!events) return Response.json({ error: "Those events could not be saved." }, { status: 400 });
  const sealed = await encryptString(JSON.stringify(events));
  await sql(
    `insert into calendar_blobs (profile_id, ciphertext, iv, tag, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (profile_id) do update set ciphertext = excluded.ciphertext, iv = excluded.iv, tag = excluded.tag, updated_at = now()`,
    [profileId, sealed.ciphertext, sealed.iv, sealed.tag],
  );
  return Response.json({ saved: true });
}
