import { createHmac } from "node:crypto";
import type {
  SendMessageResponse,
  WhatsAppClient,
} from "@kapso/whatsapp-cloud-api";
import type { ChatInstance } from "chat";
import { KapsoAdapter } from "../src/adapter.js";
import type {
  KapsoRawMessage,
  KapsoWebhookMessageReceivedEvent,
} from "../src/types.js";

export function createTestAdapter(): KapsoAdapter {
  return new KapsoAdapter({
    baseUrl: "https://api.kapso.ai/meta/whatsapp",
    kapsoApiKey: "test-api-key",
    phoneNumberId: "123456789",
    userName: "test-bot",
    webhookSecret: "test-secret",
  });
}

export function getClient(adapter: KapsoAdapter): WhatsAppClient {
  return (adapter as unknown as { client: WhatsAppClient }).client;
}

export function createLogger() {
  const logger = {
    child: () => logger,
    debug: () => undefined,
    error: () => undefined,
    info: () => undefined,
    warn: () => undefined,
  };

  return logger;
}

export async function initializeAdapterForWebhooks(
  adapter = createTestAdapter(),
) {
  const logger = createLogger();
  const processMessage = () => undefined;
  const chat = {
    getLogger: () => logger,
    processMessage,
  } as unknown as ChatInstance;

  await adapter.initialize(chat);

  return {
    adapter,
    logger,
    processMessage,
  };
}

export function createSendResponse(messageId: string): SendMessageResponse {
  return {
    messagingProduct: "whatsapp",
    contacts: [
      {
        input: "15551234567",
        waId: "15551234567",
      },
    ],
    messages: [{ id: messageId }],
  };
}

export function createWebhookSignature(body: string): string {
  return createHmac("sha256", "test-secret").update(body).digest("hex");
}

export function createKapsoWebhookRequest(
  payload: unknown,
  options?: {
    headers?: HeadersInit;
    method?: string;
    rawBody?: string;
    signature?: string;
  },
): Request {
  const body =
    options?.rawBody ??
    (typeof payload === "string" ? payload : JSON.stringify(payload));
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  headers.set(
    "x-webhook-signature",
    options?.signature ?? createWebhookSignature(body),
  );

  return new Request("https://example.com/webhooks/kapso", {
    method: options?.method ?? "POST",
    headers,
    body,
  });
}

export function createReceivedTextWebhookEvent(
  overrides?: Partial<KapsoWebhookMessageReceivedEvent>,
): KapsoWebhookMessageReceivedEvent {
  return {
    message: {
      id: "wamid.123",
      from: "15551234567",
      timestamp: "1730092800",
      type: "text",
      text: { body: "Hello from Kapso" },
      kapso: {
        direction: "inbound",
        status: "received",
        processing_status: "pending",
        origin: "cloud_api",
        has_media: false,
        content: "Hello from Kapso",
      },
    },
    conversation: {
      id: "conv_123",
      phone_number: "+1 (555) 123-4567",
      status: "active",
      metadata: {},
      phone_number_id: "123456789",
      kapso: {
        contact_name: "John Doe",
        messages_count: 1,
        last_message_id: "wamid.123",
        last_message_type: "text",
        last_message_timestamp: "2025-10-28T14:25:01Z",
        last_message_text: "Hello from Kapso",
        last_inbound_at: "2025-10-28T14:25:01Z",
        last_outbound_at: null,
      },
    },
    is_new_conversation: true,
    phone_number_id: "123456789",
    ...overrides,
  };
}

export function createTextRawMessage(): KapsoRawMessage {
  return {
    phoneNumberId: "123456789",
    userWaId: "15551234567",
    contactName: "John Doe",
    message: {
      id: "wamid.text",
      from: "15551234567",
      timestamp: "1730092800",
      type: "text",
      text: { body: "Hello *Kapso*" },
      kapso: {
        direction: "inbound",
        status: "received",
        processing_status: "pending",
        origin: "cloud_api",
        has_media: false,
        content: "Hello *Kapso*",
      },
    },
  };
}

export function createImageRawMessage(): KapsoRawMessage {
  return {
    phoneNumberId: "123456789",
    userWaId: "15551234567",
    contactName: "Jane Doe",
    message: {
      id: "wamid.image",
      from: "15551234567",
      timestamp: "1730093000",
      type: "image",
      image: {
        id: "media_123",
      },
      kapso: {
        direction: "inbound",
        status: "received",
        processing_status: "pending",
        origin: "cloud_api",
        has_media: true,
        media_url: "https://api.kapso.ai/media/photo.jpg",
        media_data: {
          url: "https://api.kapso.ai/media/photo.jpg",
          filename: "photo.jpg",
          content_type: "image/jpeg",
          byte_size: 204800,
        },
      },
    },
  };
}
