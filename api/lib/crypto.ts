import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

// ── Password Hashing (bcrypt) ──────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── AES-256-GCM Encryption ─────────────────────────────────

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.APP_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY or APP_SECRET environment variable is required");
  }
  return scryptSync(secret, "ai-agent-orchestrator-salt", 32);
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  // Store IV + encrypted data together (IV is safe to expose)
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, encrypted] = encryptedData.split(":");
  if (!ivHex || !encrypted) {
    // Legacy: data was stored plaintext before encryption was added
    // This fallback allows gradual migration
    return encryptedData;
  }
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ── Key Migration Helper ───────────────────────────────────

export function isEncrypted(data: string): boolean {
  return data.includes(":");
}
