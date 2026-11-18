import { decryptString, encryptString } from "../src/lib/crypto";
import { sql } from "../src/lib/db";

async function main() {
const secret = "not-a-real-netid-password";
const sealed = await encryptString(secret);
if (sealed.ciphertext.includes(secret) || sealed.iv.includes(secret)) {
  console.error("ciphertext leaked the secret");
  process.exit(1);
}
if ((await decryptString(sealed)) !== secret) {
  console.error("round trip failed");
  process.exit(1);
}

const profileId = "11111111-1111-4111-8111-111111111111";
const netid = await encryptString("abc12");
const password = await encryptString(secret);
await sql("delete from cas_credentials where profile_id = $1", [profileId]);
await sql(
  `insert into cas_credentials (
    profile_id, netid_ciphertext, netid_iv, netid_tag, password_ciphertext, password_iv, password_tag
  ) values ($1,$2,$3,$4,$5,$6,$7)`,
  [profileId, netid.ciphertext, netid.iv, netid.tag, password.ciphertext, password.iv, password.tag],
);
const rows = await sql<{ password_ciphertext: string }>("select password_ciphertext from cas_credentials where profile_id = $1", [profileId]);
if (!rows[0] || rows[0].password_ciphertext.includes(secret)) {
  console.error("database row is missing or plaintext");
  process.exit(1);
}
await sql("delete from cas_credentials where profile_id = $1", [profileId]);
console.log("cas encryption ok");
}

main();
