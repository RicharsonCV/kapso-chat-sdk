import type { ChatInstance } from "chat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KapsoAdapter } from "./adapter.js";
import { createKapsoAdapter } from "./factory.js";

async function initializeAndGetMetadata(adapter: KapsoAdapter) {
  const logger = {
    child: () => logger,
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  const chat = {
    getLogger: () => logger,
  } as unknown as ChatInstance;

  await adapter.initialize(chat);

  return logger.info.mock.calls[0]?.[1];
}

describe("createKapsoAdapter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.KAPSO_API_KEY;
    delete process.env.KAPSO_BASE_URL;
    delete process.env.KAPSO_BOT_USERNAME;
    delete process.env.KAPSO_PHONE_NUMBER_ID;
    delete process.env.KAPSO_WEBHOOK_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("creates an adapter from explicit config", async () => {
    const adapter = createKapsoAdapter({
      baseUrl: "https://example.com/meta/whatsapp",
      kapsoApiKey: "test-api-key",
      phoneNumberId: "123456789",
      userName: "explicit-bot",
      webhookSecret: "test-secret",
    });

    expect(adapter).toBeInstanceOf(KapsoAdapter);
    expect(adapter.name).toBe("kapso");
    expect(adapter.userName).toBe("explicit-bot");
    await expect(adapter.openDM("15551234567")).resolves.toBe(
      "kapso:123456789:15551234567",
    );
    await expect(initializeAndGetMetadata(adapter)).resolves.toEqual({
      baseUrl: "https://example.com/meta/whatsapp",
      phoneNumberId: "123456789",
    });
  });

  it("reads environment variables as fallback", async () => {
    process.env.KAPSO_API_KEY = "env-api-key";
    process.env.KAPSO_BASE_URL = "https://env.example.com/meta/whatsapp";
    process.env.KAPSO_BOT_USERNAME = "env-bot";
    process.env.KAPSO_PHONE_NUMBER_ID = "987654321";
    process.env.KAPSO_WEBHOOK_SECRET = "env-secret";

    const adapter = createKapsoAdapter();

    expect(adapter.userName).toBe("env-bot");
    await expect(adapter.openDM("15551234567")).resolves.toBe(
      "kapso:987654321:15551234567",
    );
    await expect(initializeAndGetMetadata(adapter)).resolves.toEqual({
      baseUrl: "https://env.example.com/meta/whatsapp",
      phoneNumberId: "987654321",
    });
  });

  it("applies defaults for baseUrl and userName", async () => {
    process.env.KAPSO_API_KEY = "env-api-key";
    process.env.KAPSO_PHONE_NUMBER_ID = "987654321";
    process.env.KAPSO_WEBHOOK_SECRET = "env-secret";

    const adapter = createKapsoAdapter();

    expect(adapter.userName).toBe("kapso-bot");
    await expect(initializeAndGetMetadata(adapter)).resolves.toEqual({
      baseUrl: "https://api.kapso.ai/meta/whatsapp",
      phoneNumberId: "987654321",
    });
  });

  it("throws when kapsoApiKey is missing", () => {
    expect(() =>
      createKapsoAdapter({
        phoneNumberId: "123456789",
        webhookSecret: "test-secret",
      }),
    ).toThrow("kapsoApiKey");
  });

  it("throws when phoneNumberId is missing", () => {
    expect(() =>
      createKapsoAdapter({
        kapsoApiKey: "test-api-key",
        webhookSecret: "test-secret",
      }),
    ).toThrow("phoneNumberId");
  });

  it("throws when webhookSecret is missing", () => {
    expect(() =>
      createKapsoAdapter({
        kapsoApiKey: "test-api-key",
        phoneNumberId: "123456789",
      }),
    ).toThrow("webhookSecret");
  });
});
