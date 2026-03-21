import { ValidationError } from "@chat-adapter/shared";
import { describe, expect, it } from "vitest";
import {
  decodeKapsoThreadId,
  encodeKapsoThreadId,
  normalizeUserWaId,
} from "../src/thread-utils.js";

describe("thread-utils", () => {
  it("encodes a thread ID", () => {
    expect(
      encodeKapsoThreadId({
        phoneNumberId: "123456789",
        userWaId: "15551234567",
      }),
    ).toBe("kapso:123456789:15551234567");
  });

  it("decodes a valid thread ID", () => {
    expect(decodeKapsoThreadId("kapso:123456789:15551234567")).toEqual({
      phoneNumberId: "123456789",
      userWaId: "15551234567",
    });
  });

  it("throws on invalid prefix", () => {
    expect(() =>
      decodeKapsoThreadId("whatsapp:123456789:15551234567"),
    ).toThrow(ValidationError);
  });

  it("throws on invalid thread format", () => {
    expect(() => decodeKapsoThreadId("kapso:")).toThrow(
      "Invalid Kapso thread ID format",
    );
    expect(() => decodeKapsoThreadId("kapso:123:456:789")).toThrow(
      "Invalid Kapso thread ID format",
    );
  });

  it("normalizes phone-like user IDs", () => {
    expect(normalizeUserWaId("+1 (555) 123-4567")).toBe("15551234567");
  });

  it("returns undefined for empty user IDs", () => {
    expect(normalizeUserWaId(undefined)).toBeUndefined();
    expect(normalizeUserWaId("() -")).toBeUndefined();
  });
});
