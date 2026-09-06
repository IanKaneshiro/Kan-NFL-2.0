import { describe, expect, it } from "vitest";
import { isSqliteUrl, sqliteFilePath } from "@/db/dialect";

describe("dialect", () => {
  it("detects sqlite file urls", () => {
    expect(isSqliteUrl("file:./data/local.db")).toBe(true);
    expect(isSqliteUrl("sqlite:./data/local.db")).toBe(true);
    expect(isSqliteUrl("postgresql://localhost/db")).toBe(false);
  });

  it("resolves sqlite path", () => {
    expect(sqliteFilePath("file:./data/local.db")).toBe("./data/local.db");
  });
});
