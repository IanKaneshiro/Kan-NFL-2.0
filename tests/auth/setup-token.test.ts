import { describe, expect, it } from "vitest";
import { createSetupToken, hashSetupToken } from "@/auth/setup-token";

describe("setup token", () => {
  it("creates long raw token and deterministic hash", () => {
    const { rawToken, tokenHash, expiresAt } = createSetupToken();
    expect(rawToken.length).toBeGreaterThanOrEqual(32);
    expect(hashSetupToken(rawToken)).toBe(tokenHash);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
  });
});
