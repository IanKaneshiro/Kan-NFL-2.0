import { describe, expect, it } from "vitest";
import { summarizeWeek } from "@/domain/dashboard";

describe("summarizeWeek", () => {
  it("counts unpicked unlocked games and next lock", () => {
    const now = new Date("2026-09-10T12:00:00Z");
    const s = summarizeWeek(
      "u1",
      [
        { id: "g1", kickoffAt: new Date("2026-09-10T17:00:00Z") },
        { id: "g2", kickoffAt: new Date("2026-09-11T17:00:00Z") },
        { id: "g3", kickoffAt: new Date("2026-09-10T11:00:00Z") },
      ],
      [{ userId: "u1", gameId: "g1" }],
      now,
    );
    expect(s.gamesLeft).toBe(1);
    expect(s.nextLockAt).toBe("2026-09-11T17:00:00.000Z");
  });

  it("returns zero left and null lock when all games are picked or locked", () => {
    const now = new Date("2026-09-10T12:00:00Z");
    const s = summarizeWeek(
      "u1",
      [
        { id: "g1", kickoffAt: new Date("2026-09-10T17:00:00Z") },
        { id: "g3", kickoffAt: new Date("2026-09-10T11:00:00Z") },
      ],
      [{ userId: "u1", gameId: "g1" }],
      now,
    );
    expect(s.gamesLeft).toBe(0);
    expect(s.nextLockAt).toBeNull();
  });
});
