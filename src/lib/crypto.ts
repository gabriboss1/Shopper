import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const ALGORITHM = "aes-256-gcm";

export type Sealed = { ciphertext: string; iv: string; tag: string };

async function key(): Promise<Buffer> {
  const fromEnv = process.env.SHOPPER_CAS_KEY?.trim();
  if (fromEnv) return createHash("sha256").update(fromEnv).digest();
  try {
    const existing = await readFile(".data/cas.key");
    return existing.length === 32 ? existing : createHash("sha256").update(existing).digest();
  } catch {
    await mkdir(".data", { recursive: true });
    const created = randomBytes(32);
    await writeFile(".data/cas.key", created, { mode: 0o600 });
    return created;
  }
}

export async function encryptString(plain: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, await key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export async function decryptString(sealed: Sealed): Promise<string> {
  const decipher = createDecipheriv(ALGORITHM, await key(), Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]);
  return plain.toString("utf8");
}
