import { NotImplementedError, type ChatInstance } from "chat";
import { describe, expect, it, vi } from "vitest";
import { KapsoAdapter } from "./adapter.js";

function createTestAdapter(): KapsoAdapter {
  return new KapsoAdapter({
    baseUrl: "https://api.kapso.ai/meta/whatsapp",
    kapsoApiKey: "test-api-key",
    phoneNumberId: "123456789",
    userName: "test-bot",
    webhookSecret: "test-secret",
  });
}

describe("KapsoAdapter", () => {
  describe("initialize", () => {
    it("sets botUserId and uses the chat logger", async () => {
      const adapter = createTestAdapter();
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

      expect(adapter.botUserId).toBe("123456789");
      expect(logger.info).toHaveBeenCalledWith("Kapso adapter initialized", {
        baseUrl: "https://api.kapso.ai/meta/whatsapp",
        phoneNumberId: "123456789",
      });
    });
  });

  describe("thread IDs", () => {
    it("encodes a thread ID", () => {
      const adapter = createTestAdapter();

      expect(
        adapter.encodeThreadId({
          phoneNumberId: "123456789",
          userWaId: "15551234567",
        }),
      ).toBe("kapso:123456789:15551234567");
    });

    it("decodes a valid thread ID", () => {
      const adapter = createTestAdapter();

      expect(adapter.decodeThreadId("kapso:123456789:15551234567")).toEqual({
        phoneNumberId: "123456789",
        userWaId: "15551234567",
      });
    });

    it("round-trips a thread ID", () => {
      const adapter = createTestAdapter();
      const original = {
        phoneNumberId: "123456789",
        userWaId: "15551234567",
      };

      expect(adapter.decodeThreadId(adapter.encodeThreadId(original))).toEqual(
        original,
      );
    });

    it("throws on invalid prefix", () => {
      const adapter = createTestAdapter();

      expect(() =>
        adapter.decodeThreadId("whatsapp:123456789:15551234567"),
      ).toThrow("Invalid Kapso thread ID");
    });

    it("throws on empty after prefix", () => {
      const adapter = createTestAdapter();

      expect(() => adapter.decodeThreadId("kapso:")).toThrow(
        "Invalid Kapso thread ID format",
      );
    });

    it("throws on missing userWaId", () => {
      const adapter = createTestAdapter();

      expect(() => adapter.decodeThreadId("kapso:123456789:")).toThrow(
        "Invalid Kapso thread ID format",
      );
    });

    it("throws on completely wrong format", () => {
      const adapter = createTestAdapter();

      expect(() => adapter.decodeThreadId("nonsense")).toThrow(
        "Invalid Kapso thread ID",
      );
    });

    it("throws on extra segments", () => {
      const adapter = createTestAdapter();

      expect(() => adapter.decodeThreadId("kapso:123:456:extra")).toThrow(
        "Invalid Kapso thread ID format",
      );
    });
  });

  describe("dm helpers", () => {
    it("returns the full thread ID as channel ID", () => {
      const adapter = createTestAdapter();

      expect(adapter.channelIdFromThreadId("kapso:123456789:15551234567")).toBe(
        "kapso:123456789:15551234567",
      );
    });

    it("always reports conversations as DMs", () => {
      const adapter = createTestAdapter();

      expect(adapter.isDM("kapso:123456789:15551234567")).toBe(true);
    });

    it("opens a DM by constructing the thread ID", async () => {
      const adapter = createTestAdapter();

      await expect(adapter.openDM("15551234567")).resolves.toBe(
        "kapso:123456789:15551234567",
      );
    });
  });

  describe("renderFormatted", () => {
    it("renders simple text from an AST", () => {
      const adapter = createTestAdapter();
      const ast = {
        type: "root" as const,
        children: [
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, value: "Hello world" }],
          },
        ],
      };

      expect(adapter.renderFormatted(ast)).toContain("Hello world");
    });
  });

  describe("unimplemented methods", () => {
    it("throws for parseMessage", () => {
      const adapter = createTestAdapter();

      expect(() => adapter.parseMessage({} as never)).toThrow(
        NotImplementedError,
      );
      expect(() => adapter.parseMessage({} as never)).toThrow("parseMessage");
    });

    const createAsyncCalls = () => {
      const adapter = createTestAdapter();

      return [
        {
          name: "handleWebhook",
          call: () => adapter.handleWebhook(new Request("https://example.com")),
        },
        {
          name: "postMessage",
          call: () =>
            adapter.postMessage("kapso:123456789:15551234567", "hello"),
        },
        {
          name: "editMessage",
          call: () =>
            adapter.editMessage(
              "kapso:123456789:15551234567",
              "wamid.123",
              "hello",
            ),
        },
        {
          name: "deleteMessage",
          call: () =>
            adapter.deleteMessage("kapso:123456789:15551234567", "wamid.123"),
        },
        {
          name: "addReaction",
          call: () =>
            adapter.addReaction(
              "kapso:123456789:15551234567",
              "wamid.123",
              "😀",
            ),
        },
        {
          name: "removeReaction",
          call: () =>
            adapter.removeReaction(
              "kapso:123456789:15551234567",
              "wamid.123",
              "😀",
            ),
        },
        {
          name: "startTyping",
          call: () => adapter.startTyping("kapso:123456789:15551234567"),
        },
        {
          name: "fetchMessages",
          call: () => adapter.fetchMessages("kapso:123456789:15551234567"),
        },
        {
          name: "fetchThread",
          call: () => adapter.fetchThread("kapso:123456789:15551234567"),
        },
      ] as const;
    };

    for (const { name, call } of createAsyncCalls()) {
      it(`throws for ${name}`, async () => {
        await expect(call()).rejects.toThrow(NotImplementedError);
        await expect(call()).rejects.toThrow(name);
      });
    }
  });
});
