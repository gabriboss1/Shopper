import { encryptString } from "@/lib/crypto";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CredentialRow = {
  updated_at: string | Date;
  expired: boolean;
};

function profileIdFrom(request: Request, body?: { profileId?: unknown }): string | null {
  const url = new URL(request.url);
  const value = (typeof body?.profileId === "string" ? body.profileId : url.searchParams.get("profileId")) ?? "";
  return UUID.test(value) ? value : null;
}

export async function GET(request: Request) {
  const profileId = profileIdFrom(request);
  if (!profileId) return Response.json({ paired: false }, { status: 400 });
  const rows = await sql<CredentialRow>(
    "select updated_at, (updated_at < now() - interval '14 days') as expired from cas_credentials where profile_id = $1",
    [profileId],
  );
  const row = rows[0];
  if (!row) return Response.json({ paired: false });
  if (row.expired) {
    await sql("delete from cas_credentials where profile_id = $1", [profileId]);
    return Response.json({ paired: false, expired: true });
  }
  return Response.json({ paired: true });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    profileId?: unknown;
    netid?: unknown;
    password?: unknown;
    termsAccepted?: unknown;
  } | null;
  const profileId = profileIdFrom(request, body ?? undefined);
  const netid = typeof body?.netid === "string" ? body.netid.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!profileId || netid.length < 2 || netid.length > 64 || password.length < 1 || password.length > 200) {
    return Response.json({ error: "Enter a NetID and password." }, { status: 400 });
  }
  if (body?.termsAccepted !== true) {
    return Response.json({ error: "Accept the terms to store credentials." }, { status: 400 });
  }
  const sealedNetid = await encryptString(netid);
  const sealedPassword = await encryptString(password);
  await sql(
    `insert into cas_credentials (
      profile_id, netid_ciphertext, netid_iv, netid_tag, password_ciphertext, password_iv, password_tag, terms_accepted_at, updated_at
    ) values ($1, $2, $3, $4, $5, $6, $7, now(), now())
    on conflict (profile_id) do update set
      netid_ciphertext = excluded.netid_ciphertext,
      netid_iv = excluded.netid_iv,
      netid_tag = excluded.netid_tag,
      password_ciphertext = excluded.password_ciphertext,
      password_iv = excluded.password_iv,
      password_tag = excluded.password_tag,
      terms_accepted_at = now(),
      updated_at = now()`,
    [
      profileId,
      sealedNetid.ciphertext,
      sealedNetid.iv,
      sealedNetid.tag,
      sealedPassword.ciphertext,
      sealedPassword.iv,
      sealedPassword.tag,
    ],
  );
  return Response.json({ paired: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { profileId?: unknown } | null;
  const profileId = profileIdFrom(request, body ?? undefined);
  if (!profileId) return Response.json({ error: "Missing profile." }, { status: 400 });
  await sql("delete from cas_credentials where profile_id = $1", [profileId]);
  return Response.json({ paired: false });
}
