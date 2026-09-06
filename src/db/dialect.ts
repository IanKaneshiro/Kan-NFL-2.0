/**
 * Local SQLite URLs:
 *   file:./data/local.db
 *   file:/abs/path/local.db
 *   sqlite:./data/local.db
 *
 * Everything else (postgres://, postgresql://) is Postgres (prod).
 */
export function isSqliteUrl(
  url: string | undefined = process.env.DATABASE_URL,
): boolean {
  if (!url) return false;
  const u = url.trim().toLowerCase();
  return u.startsWith("file:") || u.startsWith("sqlite:");
}

/** Resolve file path for libsql from DATABASE_URL. */
export function sqliteFilePath(url: string = process.env.DATABASE_URL ?? ""): string {
  let raw = url.trim();
  if (raw.toLowerCase().startsWith("sqlite:")) {
    raw = "file:" + raw.slice("sqlite:".length);
  }
  if (!raw.toLowerCase().startsWith("file:")) {
    throw new Error(`Not a SQLite DATABASE_URL: ${url}`);
  }
  let path = raw.slice("file:".length);
  if (path.startsWith("///")) {
    path = path.slice(2);
  } else if (path.startsWith("//")) {
    path = path.replace(/^\/\/[^/]*/, "") || path.slice(2);
  }
  return path;
}
