export type AvatarDef = {
  id: string;
  label: string;
  emoji: string;
};

const NFL: Array<[string, string]> = [
  ["ari", "Cardinals"],
  ["atl", "Falcons"],
  ["bal", "Ravens"],
  ["buf", "Bills"],
  ["car", "Panthers"],
  ["chi", "Bears"],
  ["cin", "Bengals"],
  ["cle", "Browns"],
  ["dal", "Cowboys"],
  ["den", "Broncos"],
  ["det", "Lions"],
  ["gb", "Packers"],
  ["hou", "Texans"],
  ["ind", "Colts"],
  ["jax", "Jaguars"],
  ["kc", "Chiefs"],
  ["lac", "Chargers"],
  ["lar", "Rams"],
  ["lv", "Raiders"],
  ["mia", "Dolphins"],
  ["min", "Vikings"],
  ["ne", "Patriots"],
  ["no", "Saints"],
  ["nyg", "Giants"],
  ["nyj", "Jets"],
  ["phi", "Eagles"],
  ["pit", "Steelers"],
  ["sea", "Seahawks"],
  ["sf", "49ers"],
  ["tb", "Buccaneers"],
  ["ten", "Titans"],
  ["was", "Commanders"],
];

const FUN: AvatarDef[] = [
  { id: "fun-football", label: "Football", emoji: "🏈" },
  { id: "fun-trophy", label: "Trophy", emoji: "🏆" },
  { id: "fun-helmet", label: "Helmet", emoji: "🪖" },
  { id: "fun-question", label: "Mystery", emoji: "❓" },
];

export const DEFAULT_AVATAR_ID = "fun-football";

export const AVATARS: AvatarDef[] = [
  ...NFL.map(([abbr, label]) => ({
    id: `nfl-${abbr}`,
    label,
    emoji: abbr.toUpperCase(),
  })),
  ...FUN,
];

const IDS = new Set(AVATARS.map((a) => a.id));

export function isValidAvatarId(id: string): boolean {
  return IDS.has(id);
}

export function resolveAvatarId(id: string | null | undefined): string {
  if (id && IDS.has(id)) return id;
  return DEFAULT_AVATAR_ID;
}

export function getAvatar(id: string | null | undefined): AvatarDef {
  const resolved = resolveAvatarId(id);
  return AVATARS.find((a) => a.id === resolved)!;
}

/** ESPN uses WSH for Washington; our catalog uses was. */
export function espnLogoAbbr(nflIdOrTeamAbbr: string): string {
  const raw = nflIdOrTeamAbbr
    .trim()
    .toLowerCase()
    .replace(/^nfl-/, "");
  if (raw === "was") return "wsh";
  return raw;
}

export function avatarIdForTeamAbbr(abbr: string): string | null {
  const raw = abbr.trim().toLowerCase();
  const mapped = raw === "wsh" ? "was" : raw;
  const id = `nfl-${mapped}`;
  return isValidAvatarId(id) ? id : null;
}

export function avatarSrc(id: string | null | undefined): string {
  const resolved = resolveAvatarId(id);
  if (resolved.startsWith("fun-")) return `/avatars/${resolved}.svg`;
  return `/avatars/${resolved}.png`;
}
