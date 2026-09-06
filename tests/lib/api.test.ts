import { describe, expect, it } from "vitest";
import { InvalidCredentials } from "@/domain/errors";
import { unwrapDomainError } from "@/lib/api";

describe("unwrapDomainError", () => {
  it("returns tagged domain errors as-is", () => {
    const err = new InvalidCredentials({});
    expect(unwrapDomainError(err)).toBe(err);
  });

  it("unwraps FiberFailure-shaped wrappers", () => {
    const inner = new InvalidCredentials({});
    const wrapped = {
      _tag: "FiberFailure",
      error: inner,
      toString() {
        return "(FiberFailure) InvalidCredentials: An error has occurred";
      },
    };
    expect(unwrapDomainError(wrapped)).toBe(inner);
  });

  it("recovers the tag from FiberFailure toString", () => {
    const wrapped = {
      _tag: "FiberFailure",
      toString() {
        return "(FiberFailure) InvalidCredentials: An error has occurred";
      },
    };
    expect(unwrapDomainError(wrapped)).toEqual(
      expect.objectContaining({ _tag: "InvalidCredentials" }),
    );
  });
});
