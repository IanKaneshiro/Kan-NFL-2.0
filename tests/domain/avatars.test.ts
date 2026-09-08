import { describe, expect, it } from "vitest";
import {
  AVATARS,
  DEFAULT_AVATAR_ID,
  avatarIdForTeamAbbr,
  avatarSrc,
  espnLogoAbbr,
  isValidAvatarId,
  resolveAvatarId,
} from "@/domain/avatars";

describe("avatars catalog", () => {
  it("has 32 nfl-* ids and 4 fun-* ids", () => {
    const nfl = AVATARS.filter((a) => a.id.startsWith("nfl-"));
    const fun = AVATARS.filter((a) => a.id.startsWith("fun-"));
    expect(nfl).toHaveLength(32);
    expect(fun).toHaveLength(4);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(36);
  });

  it("accepts catalog ids and rejects unknown", () => {
    expect(isValidAvatarId("nfl-kc")).toBe(true);
    expect(isValidAvatarId(DEFAULT_AVATAR_ID)).toBe(true);
    expect(isValidAvatarId("nfl-xyz")).toBe(false);
    expect(isValidAvatarId("")).toBe(false);
  });

  it("resolveAvatarId falls back to default", () => {
    expect(resolveAvatarId("nfl-buf")).toBe("nfl-buf");
    expect(resolveAvatarId("nope")).toBe(DEFAULT_AVATAR_ID);
    expect(resolveAvatarId(undefined)).toBe(DEFAULT_AVATAR_ID);
  });

  it("maps team abbreviations to catalog ids and static paths", () => {
    expect(avatarIdForTeamAbbr("KC")).toBe("nfl-kc");
    expect(avatarIdForTeamAbbr("WSH")).toBe("nfl-was");
    expect(avatarIdForTeamAbbr("xx")).toBeNull();
    expect(espnLogoAbbr("nfl-was")).toBe("wsh");
    expect(avatarSrc("nfl-kc")).toBe("/avatars/nfl-kc.png");
    expect(avatarSrc("fun-football")).toBe("/avatars/fun-football.svg");
  });
});
