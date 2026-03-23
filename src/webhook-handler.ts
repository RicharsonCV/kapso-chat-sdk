import { createHmac, timingSafeEqual } from "node:crypto";
import type { Logger } from "chat";
import type {
  KapsoMessage,
  KapsoRawMessage,
  KapsoWebhookConversation,
  KapsoWebhookMessageReceivedEvent,
} from "./types.js";
import { normalizeUserWaId } from "./thread-utils.js";
import { isRecord, readString, readValue } from "./value-readers.js";

export const KAPSO_MESSAGE_RECEIVED_EVENT = "whatsapp.message.received";

interface BuildWebhookRawMessageOptions {
  logger: Pick<Logger, "debug" | "warn">;
  phoneNumberId: string;
}

export function verifyWebhookSignature(
  body: string,
  signature: string | null,
  webhookSecret: string,
): boolean {
  if (!signature) {
    return false;
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function extractWebhookEvents(
  payload: unknown,
  batchHeader: string | null,
): KapsoWebhookMessageReceivedEvent[] {
  if (!isRecord(payload)) {
    return [];
  }

  const data = readValue(payload, "data");
  if (Array.isArray(data)) {
    return data.filter(isKapsoWebhookMessageReceivedEvent);
  }

  if (batchHeader === "true") {
    return [];
  }

  return isKapsoWebhookMessageReceivedEvent(payload) ? [payload] : [];
}

export function buildWebhookRawMessage(
  event: KapsoWebhookMessageReceivedEvent,
  options: BuildWebhookRawMessageOptions,
): KapsoRawMessage | null {
  const { logger, phoneNumberId: defaultPhoneNumberId } = options;
  const { message } = event;
  const kapso = message.kapso;
  const direction = kapso?.direction;
  if (direction && direction !== "inbound") {
    logger.debug("Ignoring non-inbound Kapso message event", {
      direction,
      messageId: message.id,
    });
    return null;
  }

  const conversation = event.conversation;
  const phoneNumberId =
    event.phone_number_id ??
    event.phoneNumberId ??
    conversation?.phone_number_id ??
    conversation?.phoneNumberId ??
    defaultPhoneNumberId;
  const userWaId =
    normalizeUserWaId(message.from) ??
    normalizeUserWaId(conversation?.phone_number ?? conversation?.phoneNumber);

  if (!userWaId) {
    logger.warn("Kapso webhook message missing sender identifier", {
      messageId: message.id,
      phoneNumberId,
    });
    return null;
  }

  return {
    phoneNumberId,
    userWaId,
    message,
    contactName: extractContactName(conversation),
  };
}

function isKapsoMessage(value: unknown): value is KapsoMessage {
  return (
    isRecord(value) &&
    readString(readValue(value, "id")) !== undefined &&
    readString(readValue(value, "type")) !== undefined &&
    readString(readValue(value, "timestamp")) !== undefined
  );
}

function isKapsoWebhookMessageReceivedEvent(
  value: unknown,
): value is KapsoWebhookMessageReceivedEvent {
  if (!isRecord(value)) {
    return false;
  }

  return isKapsoMessage(readValue(value, "message"));
}

function extractContactName(
  conversation: KapsoWebhookConversation | undefined,
): string | undefined {
  return conversation?.kapso?.contactName ?? conversation?.kapso?.contact_name;
}
