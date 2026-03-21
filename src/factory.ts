import { ValidationError } from "@chat-adapter/shared";
import { KapsoAdapter } from "./adapter.js";
import type { KapsoAdapterConfig } from "./types.js";

const DEFAULT_KAPSO_BASE_URL = "https://api.kapso.ai/meta/whatsapp";
const DEFAULT_KAPSO_BOT_USERNAME = "kapso-bot";

/**
 * Create a Kapso adapter.
 *
 * Credentials and defaults may be provided explicitly or via environment
 * variables resolved here before constructing the adapter.
 */
export function createKapsoAdapter(config?: KapsoAdapterConfig): KapsoAdapter {
  const kapsoApiKey = config?.kapsoApiKey ?? process.env.KAPSO_API_KEY;
  const baseUrl =
    config?.baseUrl ?? process.env.KAPSO_BASE_URL ?? DEFAULT_KAPSO_BASE_URL;
  const phoneNumberId =
    config?.phoneNumberId ?? process.env.KAPSO_PHONE_NUMBER_ID;
  const userName =
    config?.userName ??
    process.env.KAPSO_BOT_USERNAME ??
    DEFAULT_KAPSO_BOT_USERNAME;
  const webhookSecret =
    config?.webhookSecret ?? process.env.KAPSO_WEBHOOK_SECRET;

  if (!kapsoApiKey) {
    throw new ValidationError(
      "kapso",
      "kapsoApiKey is required. Set KAPSO_API_KEY or provide it in config.",
    );
  }
  if (!phoneNumberId) {
    throw new ValidationError(
      "kapso",
      "phoneNumberId is required. Set KAPSO_PHONE_NUMBER_ID or provide it in config.",
    );
  }
  if (!webhookSecret) {
    throw new ValidationError(
      "kapso",
      "webhookSecret is required. Set KAPSO_WEBHOOK_SECRET or provide it in config.",
    );
  }

  return new KapsoAdapter({
    baseUrl,
    kapsoApiKey,
    phoneNumberId,
    userName,
    webhookSecret,
  });
}
