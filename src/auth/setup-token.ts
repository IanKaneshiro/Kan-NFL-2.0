import { createHash, randomBytes } from "node:crypto";

const SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashSetupToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function createSetupToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashSetupToken(rawToken),
    expiresAt: new Date(Date.now() + SETUP_TTL_MS),
  };
}
