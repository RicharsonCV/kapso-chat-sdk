/**
 * Type definitions for the Kapso adapter.
 *
 * Uses types from @kapso/whatsapp-cloud-api wherever possible.
 * Defines adapter-specific configuration, thread identity, and shared
 * message shapes used by the Kapso Chat SDK adapter.
 */

import type { UnifiedMessage } from "@kapso/whatsapp-cloud-api";

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for the Kapso Chat SDK adapter.
 *
 * This adapter is Kapso-first:
 * - Outbound messages and history queries go through the Kapso proxy
 * - Inbound webhook verification uses Kapso webhook signatures
 */
export interface KapsoAdapterConfig {
  /** Kapso proxy base URL. Defaults to https://api.kapso.ai/meta/whatsapp */
  baseUrl?: string;
  /** Kapso API key. Falls back to KAPSO_API_KEY env var. */
  kapsoApiKey?: string;
  /** WhatsApp phone number ID used for send/query operations. Falls back to KAPSO_PHONE_NUMBER_ID env var. */
  phoneNumberId?: string;
  /** Bot display name. Defaults to "kapso-bot". */
  userName?: string;
  /** Shared secret used to verify Kapso webhook signatures. Must match the webhook `secret_key` configured in Kapso Dashboard. */
  webhookSecret?: string;
}

// =============================================================================
// Thread ID
// =============================================================================

/**
 * Decoded thread ID for WhatsApp via Kapso.
 *
 * WhatsApp conversations are always 1:1 between a business phone number and a user.
 * There is no concept of threads or channels.
 *
 * Format: kapso:{phoneNumberId}:{userWaId}
 */
export interface KapsoThreadId {
  /** Whatsapp Business phone number ID */
  phoneNumberId: string;
  /** User's WhatsApp ID (their phone number) */
  userWaId: string;
}

/** Normalized WhatsApp message shape used across webhooks and history APIs. */
export type KapsoMessage = UnifiedMessage;

/**
 * Platform-specific raw message stored in Chat `message.raw`.
 *
 * Keeps the receiving business phone number alongside the normalized
 * WhatsApp message returned by the Kapso SDK.
 */
export interface KapsoRawMessage {
  /** WhatsApp phone number ID that owns the conversation. */
  phoneNumberId: string;
  /** Normalized WhatsApp message. */
  message: KapsoMessage;
  /** Optional display name resolved from webhook contacts. */
  contactName?: string;
}
