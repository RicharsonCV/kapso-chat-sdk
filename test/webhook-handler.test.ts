import { describe, expect, it, vi } from "vitest";
import {
  buildWebhookRawMessage,
  extractWebhookEvents,
  KAPSO_MESSAGE_RECEIVED_EVENT,
  verifyWebhookSignature,
} from "../src/webhook-handler.js";
import {
  createReceivedTextWebhookEvent,
  createWebhookSignature,
} from "./kapso-test-helpers.js";

describe("webhook-handler", () => {
  describe("verifyWebhookSignature", () => {
    it("returns true for a valid signature", () => {
      const body = JSON.stringify({ ok: true });

      expect(
        verifyWebhookSignature(
          body,
          createWebhookSignature(body),
          "test-secret",
        ),
      ).toBe(true);
    });

    it("returns false for missing or invalid signatures", () => {
      const body = JSON.stringify({ ok: true });

      expect(verifyWebhookSignature(body, null, "test-secret")).toBe(false);
      expect(verifyWebhookSignature(body, "invalid", "test-secret")).toBe(
        false,
      );
    });
  });

  describe("extractWebhookEvents", () => {
    it("returns a single event for non-batch payloads", () => {
      const event = createReceivedTextWebhookEvent();

      expect(extractWebhookEvents(event, null)).toEqual([event]);
    });

    it("returns filtered data for batch payloads", () => {
      const event = createReceivedTextWebhookEvent();

      expect(
        extractWebhookEvents(
          {
            data: [event, { invalid: true }],
          },
          "true",
        ),
      ).toEqual([event]);
    });

    it("returns an empty array for malformed batch payloads", () => {
      expect(extractWebhookEvents({}, "true")).toEqual([]);
      expect(extractWebhookEvents("invalid", null)).toEqual([]);
    });
  });

  describe("buildWebhookRawMessage", () => {
    it("builds a raw inbound message", () => {
      const logger = {
        debug: vi.fn(),
        warn: vi.fn(),
      };

      expect(
        buildWebhookRawMessage(createReceivedTextWebhookEvent(), {
          logger,
          phoneNumberId: "123456789",
        }),
      ).toEqual({
        phoneNumberId: "123456789",
        userWaId: "15551234567",
        message: createReceivedTextWebhookEvent().message,
        contactName: "John Doe",
      });
    });

    it("ignores non-inbound messages", () => {
      const logger = {
        debug: vi.fn(),
        warn: vi.fn(),
      };

      const raw = buildWebhookRawMessage(
        createReceivedTextWebhookEvent({
          message: {
            ...createReceivedTextWebhookEvent().message,
            kapso: {
              direction: "outbound",
            },
          },
        }),
        {
          logger,
          phoneNumberId: "123456789",
        },
      );

      expect(raw).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        "Ignoring non-inbound Kapso message event",
        {
          direction: "outbound",
          messageId: "wamid.123",
        },
      );
    });

    it("warns and skips payloads without a sender identifier", () => {
      const logger = {
        debug: vi.fn(),
        warn: vi.fn(),
      };

      const raw = buildWebhookRawMessage(
        createReceivedTextWebhookEvent({
          message: {
            ...createReceivedTextWebhookEvent().message,
            from: undefined,
          },
          conversation: {
            ...createReceivedTextWebhookEvent().conversation,
            phone_number: undefined,
          },
        }),
        {
          logger,
          phoneNumberId: "123456789",
        },
      );

      expect(raw).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Kapso webhook message missing sender identifier",
        {
          messageId: "wamid.123",
          phoneNumberId: "123456789",
        },
      );
    });
  });
});
