import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const source =
    process.env.AI_KEY_ENCRYPTION_SECRET ?? process.env.SESSION_SECRET ?? null;
  if (!source) {
    throw new Error(
      "Cannot encrypt AI keys: neither AI_KEY_ENCRYPTION_SECRET nor SESSION_SECRET is set.",
    );
  }
  cachedKey = Buffer.from(
    hkdfSync("sha256", source, Buffer.alloc(0), "ai-provider-key-v1", KEY_LEN),
  );
  return cachedKey;
}

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedSecret): string {
  const decipher = createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function maskKey(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}
