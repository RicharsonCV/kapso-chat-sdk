import {
  extractCard,
  extractFiles,
  ValidationError,
} from "@chat-adapter/shared";
import {
  type SendMessageResponse,
  WhatsAppClient,
} from "@kapso/whatsapp-cloud-api";
import {
  type Adapter,
  type AdapterPostableMessage,
  type ChatInstance,
  ConsoleLogger,
  convertEmojiPlaceholders,
  defaultEmojiResolver,
  type EmojiValue,
  type FetchOptions,
  type FetchResult,
  type FormattedContent,
  type Logger,
  Message,
  NotImplementedError,
  type RawMessage,
  type ThreadInfo,
  type WebhookOptions,
} from "chat";
import {
  buildAttachments,
  extractMessageText,
  parseUnixTimestamp,
  resolveSenderId,
} from "./message-parser.js";
import { KapsoFormatConverter } from "./format-converter.js";
import { decodeKapsoThreadId, encodeKapsoThreadId } from "./thread-utils.js";
import {
  buildWebhookRawMessage,
  extractWebhookEventName,
  extractWebhookEvents,
  KAPSO_MESSAGE_RECEIVED_EVENT,
  verifyWebhookSignature,
} from "./webhook-handler.js";
import type {
  KapsoAdapterConfig,
  KapsoRawMessage,
  KapsoThreadId,
} from "./types.js";

/** Maximum message length for WhatsApp Cloud API */
const KAPSO_MESSAGE_LIMIT = 4096;
const MAX_PROCESSED_WEBHOOK_KEYS = 1024;

/**
 * Split text into chunks that fit within WhatsApp's message limit,
 * breaking on paragraph boundaries (\n\n) when possible, then line
 * boundaries (\n), and finally at the character limit as a last resort.
 */
function splitMessage(text: string): string[] {
  if (text.length <= KAPSO_MESSAGE_LIMIT) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > KAPSO_MESSAGE_LIMIT) {
    const slice = remaining.slice(0, KAPSO_MESSAGE_LIMIT);

    // Try to break at a paragraph boundary
    let breakIndex = slice.lastIndexOf("\n\n");
    let breakLength = 2;
    if (breakIndex === -1 || breakIndex < KAPSO_MESSAGE_LIMIT / 2) {
      // Try a line boundary
      breakIndex = slice.lastIndexOf("\n");
      breakLength = 1;
    }
    if (breakIndex === -1 || breakIndex < KAPSO_MESSAGE_LIMIT / 2) {
      // Hard break at the limit
      breakIndex = KAPSO_MESSAGE_LIMIT;
      breakLength = 0;
    }

    const chunkEnd = breakIndex + breakLength;
    chunks.push(remaining.slice(0, chunkEnd));
    remaining = remaining.slice(chunkEnd);
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Kapso adapter for Chat SDK.
 *
 * Supports outbound text messages, reactions, and inbound Kapso webhook
 * handling for real-time message processing.
 *
 * History/thread APIs are implemented separately.
 */
export class KapsoAdapter implements Adapter<KapsoThreadId, KapsoRawMessage> {
  readonly name = "kapso";
  readonly userName: string;

  private readonly baseUrl: string;
  private readonly kapsoApiKey: string;
  private readonly phoneNumberId: string;
  private readonly webhookSecret: string;
  private readonly client: WhatsAppClient;
  private readonly formatConverter = new KapsoFormatConverter();
  private chat: ChatInstance | null = null;
  private logger: Logger;
  private _botUserId: string | null = null;
  private readonly processedWebhookKeys = new Map<string, number>();

  get botUserId(): string | undefined {
    return this._botUserId ?? undefined;
  }

  constructor(config: Required<KapsoAdapterConfig>) {
    this.baseUrl = config.baseUrl;
    this.kapsoApiKey = config.kapsoApiKey;
    this.phoneNumberId = config.phoneNumberId;
    this.userName = config.userName;
    this.webhookSecret = config.webhookSecret;
    this.client = new WhatsAppClient({
      baseUrl: this.baseUrl,
      kapsoApiKey: this.kapsoApiKey,
    });
    this.logger = new ConsoleLogger("info").child("kapso");
  }

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
    this.logger = chat.getLogger("kapso");
    this._botUserId = this.phoneNumberId;

    this.logger.info("Kapso adapter initialized", {
      baseUrl: this.baseUrl,
      phoneNumberId: this.phoneNumberId,
    });
  }

  encodeThreadId(platformData: KapsoThreadId): string {
    return encodeKapsoThreadId(platformData);
  }

  decodeThreadId(threadId: string): KapsoThreadId {
    return decodeKapsoThreadId(threadId);
  }

  channelIdFromThreadId(threadId: string): string {
    return threadId;
  }

  isDM(_threadId: string): boolean {
    return true;
  }

  async openDM(userId: string): Promise<string> {
    return this.encodeThreadId({
      phoneNumberId: this.phoneNumberId,
      userWaId: userId,
    });
  }

  renderFormatted(content: FormattedContent): string {
    return this.formatConverter.fromAst(content);
  }

  async handleWebhook(
    request: Request,
    options?: WebhookOptions,
  ): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "POST",
        },
      });
    }

    const body = await request.text();
    const signature = request.headers.get("x-webhook-signature");
    if (!verifyWebhookSignature(body, signature, this.webhookSecret)) {
      return new Response("Invalid signature", { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      this.logger.error("Kapso webhook invalid JSON", {
        contentType: request.headers.get("content-type"),
        bodyPreview: body.slice(0, 200),
      });
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!this.chat) {
      this.logger.warn("Chat instance not initialized, ignoring webhook");
      return new Response("OK", { status: 200 });
    }

    const eventName =
      request.headers.get("x-webhook-event") ?? extractWebhookEventName(payload);

    if (eventName && eventName !== KAPSO_MESSAGE_RECEIVED_EVENT) {
      this.logger.debug("Ignoring unsupported Kapso webhook event", {
        event: eventName,
      });
      return new Response("OK", { status: 200 });
    }

    const idempotencyKey = request.headers.get("x-idempotency-key");
    if (idempotencyKey && this.processedWebhookKeys.has(idempotencyKey)) {
      this.logger.debug("Ignoring duplicate Kapso webhook delivery", {
        idempotencyKey,
      });
      return new Response("OK", { status: 200 });
    }

    const events = extractWebhookEvents(
      payload,
      request.headers.get("x-webhook-batch"),
    );

    for (const event of events) {
      const raw = buildWebhookRawMessage(event, {
        logger: this.logger,
        phoneNumberId: this.phoneNumberId,
      });
      if (!raw) {
        continue;
      }

      const threadId = this.encodeThreadId({
        phoneNumberId: raw.phoneNumberId,
        userWaId: raw.userWaId,
      });

      this.chat.processMessage(
        this,
        threadId,
        async () => this.parseMessage(raw),
        options,
      );
    }

    if (idempotencyKey && events.length > 0) {
      this.rememberProcessedWebhookKey(idempotencyKey);
    }

    return new Response("OK", { status: 200 });
  }

  parseMessage(raw: KapsoRawMessage): Message<KapsoRawMessage> {
    const threadId = this.encodeThreadId({
      phoneNumberId: raw.phoneNumberId,
      userWaId: raw.userWaId,
    });
    const senderId = resolveSenderId(raw);
    const isMe = senderId === this._botUserId;
    const displayName = raw.contactName ?? (isMe ? this.userName : raw.userWaId);
    const text = extractMessageText(raw.message);

    return new Message<KapsoRawMessage>({
      id: raw.message.id,
      threadId,
      text,
      formatted: this.formatConverter.toAst(text),
      raw,
      author: {
        userId: senderId,
        userName: displayName,
        fullName: displayName,
        isBot: false,
        isMe,
      },
      metadata: {
        dateSent: parseUnixTimestamp(raw.message.timestamp),
        edited: false,
      },
      attachments: buildAttachments(raw.message),
    });
  }

  async postMessage(
    threadId: string,
    message: AdapterPostableMessage,
  ): Promise<RawMessage<KapsoRawMessage>> {
    const { userWaId } = this.decodeThreadId(threadId);
    this.assertOutboundTextOnly(message);

    const body = convertEmojiPlaceholders(
      this.formatConverter.renderPostable(message),
      "whatsapp",
    );

    if (body.trim().length === 0) {
      throw new ValidationError(
        "kapso",
        "Kapso adapter requires a non-empty text message.",
      );
    }

    const chunks = splitMessage(body);
    let result: RawMessage<KapsoRawMessage> | null = null;

    for (const chunk of chunks) {
      const response = await this.client.messages.sendText({
        phoneNumberId: this.phoneNumberId,
        to: userWaId,
        body: chunk,
      });

      result = this.buildRawTextMessage(threadId, userWaId, chunk, response);
    }

    if (!result) {
      throw new ValidationError(
        "kapso",
        "Kapso adapter requires a non-empty text message.",
      );
    }

    return result;
  }

  async editMessage(
    _threadId: string,
    _messageId: string,
    _message: AdapterPostableMessage,
  ): Promise<RawMessage<KapsoRawMessage>> {
    throw new Error(
      "Kapso/WhatsApp does not support editing messages. Use postMessage() instead.",
    );
  }

  async deleteMessage(_threadId: string, _messageId: string): Promise<void> {
    throw new Error("Kapso/WhatsApp does not support deleting messages.");
  }

  async addReaction(
    threadId: string,
    messageId: string,
    emoji: EmojiValue | string,
  ): Promise<void> {
    const { userWaId } = this.decodeThreadId(threadId);

    await this.client.messages.sendReaction({
      phoneNumberId: this.phoneNumberId,
      to: userWaId,
      reaction: {
        messageId,
        emoji: defaultEmojiResolver.toGChat(emoji),
      },
    });
  }

  async removeReaction(
    threadId: string,
    messageId: string,
    _emoji: EmojiValue | string,
  ): Promise<void> {
    const { userWaId } = this.decodeThreadId(threadId);

    await this.client.messages.sendReaction({
      phoneNumberId: this.phoneNumberId,
      to: userWaId,
      reaction: {
        messageId,
        emoji: "",
      },
    });
  }

  async startTyping(_threadId: string, _status?: string): Promise<void> {
    this.notImplemented("startTyping");
  }

  async fetchMessages(
    _threadId: string,
    _options?: FetchOptions,
  ): Promise<FetchResult<KapsoRawMessage>> {
    this.notImplemented("fetchMessages");
  }

  async fetchThread(_threadId: string): Promise<ThreadInfo> {
    this.notImplemented("fetchThread");
  }

  private assertOutboundTextOnly(message: AdapterPostableMessage): void {
    const hasAttachments =
      typeof message === "object" &&
      message !== null &&
      "attachments" in message &&
      Array.isArray(message.attachments) &&
      message.attachments.length > 0;
    const hasFiles = extractFiles(message).length > 0;

    if (extractCard(message) || hasAttachments || hasFiles) {
      throw new ValidationError(
        "kapso",
        "Kapso adapter only supports text messages. Cards, attachments, and files are not supported.",
      );
    }
  }

  private buildRawTextMessage(
    threadId: string,
    to: string,
    body: string,
    response: SendMessageResponse,
  ): RawMessage<KapsoRawMessage> {
    const id = this.getResponseMessageId(response, "text message");

    return {
      id,
      threadId,
      raw: {
        phoneNumberId: this.phoneNumberId,
        userWaId: to,
        message: {
          id,
          type: "text",
          timestamp: String(Math.floor(Date.now() / 1000)),
          from: this.phoneNumberId,
          to,
          text: {
            body,
          },
        },
      },
    };
  }

  private getResponseMessageId(
    response: SendMessageResponse,
    operation: string,
  ): string {
    const messageId = response.messages[0]?.id;

    if (!messageId) {
      throw new ValidationError(
        "kapso",
        `Kapso SDK did not return a message ID for ${operation}.`,
      );
    }

    return messageId;
  }

  private rememberProcessedWebhookKey(idempotencyKey: string): void {
    this.processedWebhookKeys.set(idempotencyKey, Date.now());

    while (this.processedWebhookKeys.size > MAX_PROCESSED_WEBHOOK_KEYS) {
      const oldestKey = this.processedWebhookKeys.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.processedWebhookKeys.delete(oldestKey);
    }
  }

  private notImplemented(method: string): never {
    throw new NotImplementedError(
      `Kapso adapter ${method} is not implemented.`,
      method,
    );
  }
}
