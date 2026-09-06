import { describe, expect, it } from "vitest";
import { deriveCurrentWeek } from "@/domain/season";

describe("deriveCurrentWeek", () => {
  it("returns 1 when no games", () => {
    expect(deriveCurrentWeek([])).toBe(1);
  });

  it("returns first week with a non-final game", () => {
    expect(
      deriveCurrentWeek([
        { week: 1, status: "final" },
        { week: 2, status: "in_progress" },
        { week: 3, status: "scheduled" },
      ]),
    ).toBe(2);
  });

  it("returns last week when all final", () => {
    expect(
      deriveCurrentWeek([
        { week: 1, status: "final" },
        { week: 18, status: "final" },
      ]),
    ).toBe(18);
  });
});
