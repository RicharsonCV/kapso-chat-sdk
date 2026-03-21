import { describe, expect, it } from "vitest";
import {
  isRecord,
  readNumber,
  readString,
  readValue,
} from "../src/value-readers.js";

describe("value-readers", () => {
  it("detects plain records", () => {
    expect(isRecord({ foo: "bar" })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("text")).toBe(false);
  });

  it("reads the first matching key from a record", () => {
    expect(readValue({ b: 2 }, "a", "b", "c")).toBe(2);
    expect(readValue(undefined, "a")).toBeUndefined();
  });

  it("reads non-empty strings", () => {
    expect(readString("hello")).toBe("hello");
    expect(readString("")).toBeUndefined();
    expect(readString(123)).toBeUndefined();
  });

  it("reads numeric values and numeric strings", () => {
    expect(readNumber(42)).toBe(42);
    expect(readNumber("42")).toBe(42);
    expect(readNumber("not-a-number")).toBeUndefined();
    expect(readNumber(undefined)).toBeUndefined();
  });
});
