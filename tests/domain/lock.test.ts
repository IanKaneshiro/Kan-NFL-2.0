import { describe, expect, it } from "vitest";
import { isGameLocked } from "@/domain/lock";

describe("isGameLocked", () => {
  it("is false before kickoff", () => {
    const kickoff = new Date("2026-09-13T17:00:00.000Z");
    const now = new Date("2026-09-13T16:59:59.000Z");
    expect(isGameLocked(kickoff, now)).toBe(false);
  });

  it("is true at kickoff", () => {
    const kickoff = new Date("2026-09-13T17:00:00.000Z");
    expect(isGameLocked(kickoff, kickoff)).toBe(true);
  });
});
