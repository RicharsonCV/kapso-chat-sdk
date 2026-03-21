import { ValidationError } from "@chat-adapter/shared";
import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import {
  type Adapter,
  type AdapterPostableMessage,
  type ChatInstance,
  ConsoleLogger,
  type EmojiValue,
  type FetchOptions,
  type FetchResult,
  type FormattedContent,
  type Logger,
  type Message,
  NotImplementedError,
  type RawMessage,
  type ThreadInfo,
  type WebhookOptions,
} from "chat";
import { KapsoFormatConverter } from "./format-converter.js";
import type {
  KapsoAdapterConfig,
  KapsoRawMessage,
  KapsoThreadId,
} from "./types.js";

/**
 * Kapso adapter for Chat SDK.
 *
 * This skeleton is intentionally limited to Kapso webhook mode and local
 * runtime helpers. Network behavior will be added later
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
  private logger: Logger;
  private _botUserId: string | null = null;

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
    this.logger = chat.getLogger("kapso");
    this._botUserId = this.phoneNumberId;

    this.logger.info("Kapso adapter initialized", {
      baseUrl: this.baseUrl,
      phoneNumberId: this.phoneNumberId,
    });
  }

  encodeThreadId(platformData: KapsoThreadId): string {
    return `kapso:${platformData.phoneNumberId}:${platformData.userWaId}`;
  }

  decodeThreadId(threadId: string): KapsoThreadId {
    if (!threadId.startsWith("kapso:")) {
      throw new ValidationError(
        "kapso",
        `Invalid Kapso thread ID: ${threadId}`,
      );
    }

    const withoutPrefix = threadId.slice("kapso:".length);
    if (!withoutPrefix) {
      throw new ValidationError(
        "kapso",
        `Invalid Kapso thread ID format: ${threadId}`,
      );
    }

    const parts = withoutPrefix.split(":");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new ValidationError(
        "kapso",
        `Invalid Kapso thread ID format: ${threadId}`,
      );
    }

    return {
      phoneNumberId: parts[0],
      userWaId: parts[1],
    };
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
    _request: Request,
    _options?: WebhookOptions,
  ): Promise<Response> {
    this.notImplemented("handleWebhook");
  }

  parseMessage(_raw: KapsoRawMessage): Message<KapsoRawMessage> {
    return this.notImplemented("parseMessage");
  }

  async postMessage(
    _threadId: string,
    _message: AdapterPostableMessage,
  ): Promise<RawMessage<KapsoRawMessage>> {
    this.notImplemented("postMessage");
  }

  async editMessage(
    _threadId: string,
    _messageId: string,
    _message: AdapterPostableMessage,
  ): Promise<RawMessage<KapsoRawMessage>> {
    this.notImplemented("editMessage");
  }

  async deleteMessage(_threadId: string, _messageId: string): Promise<void> {
    this.notImplemented("deleteMessage");
  }

  async addReaction(
    _threadId: string,
    _messageId: string,
    _emoji: EmojiValue | string,
  ): Promise<void> {
    this.notImplemented("addReaction");
  }

  async removeReaction(
    _threadId: string,
    _messageId: string,
    _emoji: EmojiValue | string,
  ): Promise<void> {
    this.notImplemented("removeReaction");
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

  private notImplemented(method: string): never {
    throw new NotImplementedError(
      `Kapso adapter ${method} is not implemented yet.`,
      method,
    );
  }
}
