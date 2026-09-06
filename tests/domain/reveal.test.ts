import { describe, expect, it } from "vitest";
import { canRevealPicks } from "@/domain/reveal";

describe("canRevealPicks", () => {
  it("hides before kickoff and reveals at/after", () => {
    const kickoff = new Date("2026-09-13T17:00:00.000Z");
    expect(canRevealPicks(kickoff, new Date("2026-09-13T16:00:00.000Z"))).toBe(
      false,
    );
    expect(canRevealPicks(kickoff, kickoff)).toBe(true);
  });
});
