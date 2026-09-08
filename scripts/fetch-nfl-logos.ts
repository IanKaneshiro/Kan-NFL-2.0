import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEAMS: Array<[fileAbbr: string, espnAbbr: string]> = [
  ["ari", "ari"],
  ["atl", "atl"],
  ["bal", "bal"],
  ["buf", "buf"],
  ["car", "car"],
  ["chi", "chi"],
  ["cin", "cin"],
  ["cle", "cle"],
  ["dal", "dal"],
  ["den", "den"],
  ["det", "det"],
  ["gb", "gb"],
  ["hou", "hou"],
  ["ind", "ind"],
  ["jax", "jax"],
  ["kc", "kc"],
  ["lac", "lac"],
  ["lar", "lar"],
  ["lv", "lv"],
  ["mia", "mia"],
  ["min", "min"],
  ["ne", "ne"],
  ["no", "no"],
  ["nyg", "nyg"],
  ["nyj", "nyj"],
  ["phi", "phi"],
  ["pit", "pit"],
  ["sea", "sea"],
  ["sf", "sf"],
  ["tb", "tb"],
  ["ten", "ten"],
  ["was", "wsh"],
];

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const dir = resolve(root, "public/avatars");
  await mkdir(dir, { recursive: true });

  for (const [fileAbbr, espnAbbr] of TEAMS) {
    const url = `https://a.espncdn.com/i/teamlogos/nfl/500/${espnAbbr}.png`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed ${espnAbbr}: ${res.status} ${url}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = resolve(dir, `nfl-${fileAbbr}.png`);
    await writeFile(dest, buf);
    console.log(`Wrote ${dest} (${buf.length} bytes)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
