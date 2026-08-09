import { afterEach, describe, expect, it } from "vitest";
import { readArgument, readPositiveInteger, readPositiveIntegerEnvironment } from "../src/args.js";

const originalArgv = process.argv;

function withArgv(...args: string[]): void {
  process.argv = ["node", "script", ...args];
}

afterEach(() => {
  process.argv = originalArgv;
});

describe("readArgument", () => {
  it("rejects the next flag being consumed as a value", () => {
    withArgv("--tag", "--limit", "250");
    expect(() => readArgument("tag", "Retro")).toThrow("--tag requires a value.");
  });

  it("rejects a trailing flag with no value", () => {
    withArgv("--tag");
    expect(() => readArgument("tag", "Retro")).toThrow("--tag requires a value.");
  });

  it("falls back when the flag is absent", () => {
    withArgv("--limit", "250");
    expect(readArgument("tag", "Retro")).toBe("Retro");
  });
});

describe("readPositiveInteger", () => {
  it("reads and validates a flag value", () => {
    withArgv("--limit", "250");
    expect(readPositiveInteger("limit", 500)).toBe(250);
    withArgv("--limit", "0");
    expect(() => readPositiveInteger("limit", 500)).toThrow("--limit must be a positive integer");
  });
});

describe("readPositiveIntegerEnvironment", () => {
  it("blames the environment variable rather than the flag", () => {
    expect(() => readPositiveIntegerEnvironment("STEAMSPY_MAX_RECORDS", "abc", 500))
      .toThrow('STEAMSPY_MAX_RECORDS must be a positive integer; received "abc".');
  });

  it("falls back for unset and blank values", () => {
    expect(readPositiveIntegerEnvironment("STEAMSPY_MAX_RECORDS", undefined, 500)).toBe(500);
    expect(readPositiveIntegerEnvironment("STEAMSPY_MAX_RECORDS", "   ", 500)).toBe(500);
  });
});
