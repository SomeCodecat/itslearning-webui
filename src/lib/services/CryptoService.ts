import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

// Ensure a secure key in .env or generate one (for demo purposes)
// In production, this MUST be a 32-byte hex string in .env
const ALGORITHM = "aes-256-gcm";

let warnedAboutInsecureKey = false;

// Resolved lazily (not at import time) so the module never throws on import.
// In production a missing/invalid ENCRYPTION_KEY fails loud instead of silently
// falling back to a well-known insecure key.
function getKey(): Buffer {
  const configured = process.env.ENCRYPTION_KEY;

  if (configured) {
    const key = Buffer.from(configured, "hex");
    if (key.length !== 32) {
      throw new Error(
        "ENCRYPTION_KEY must be a 32-byte value encoded as a 64-character hex string",
      );
    }
    return key;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY must be set in production");
  }

  if (!warnedAboutInsecureKey) {
    console.warn(
      "ENCRYPTION_KEY is unset; using an insecure development-only key. Do not use this in production.",
    );
    warnedAboutInsecureKey = true;
  }

  return Buffer.alloc(32, "a"); // Development-only fallback.
}

export class CryptoService {
  static encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = randomBytes(12); // GCM standard IV size
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag().toString("hex");

    return {
      encrypted,
      iv: iv.toString("hex"),
      tag, // In typical GCM usage we often append tag to ciphertext, but we can store it properly or imply it.
      // Wait, the schema only has 'iv' and 'pwd'.
      // Usually we store `iv:ciphertext:tag` or separate columns.
      // Our schema has `itslearningIv` and `itslearningPwd`.
      // We should append the tag to the password or add a field.
      // Convention: Store as `tag + ciphertext` in the password field?
      // Or `ciphertext + tag`.
      // Let's stick to Node's default: `encrypted` usually doesn't include tag in `update/final`.
      // We MUST store the tag for GCM auth.
      // I will store `encrypted` as `tag:ciphertext`.
    };
  }

  // Actually, to fit into `itslearningPwd` string, let's format it:
  // "hexTag:hexCiphertext"

  static encryptToString(text: string): { encrypted: string; iv: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");

    return {
      encrypted: `${tag}:${encrypted}`,
      iv: iv.toString("hex"),
    };
  }

  static decrypt(encryptedPkg: string, ivHex: string): string {
    const parts = encryptedPkg.split(":");
    if (parts.length !== 2) throw new Error("Invalid encrypted format");

    const [tagHex, ciphertext] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
