import type { CardElement } from "chat";
import { describe, expect, it } from "vitest";
import {
  cardToWhatsApp,
  cardToWhatsAppText,
  decodeWhatsAppCallbackData,
  encodeWhatsAppCallbackData,
} from "../src/cards.js";

describe("cards", () => {
  describe("cardToWhatsApp", () => {
    it("converts supported cards into interactive reply buttons", () => {
      const card: CardElement = {
        type: "card",
        title: "Choose an action",
        children: [
          { type: "text", content: "What would you like to do?" },
          {
            type: "actions",
            children: [
              { type: "button", id: "approve", label: "Approve" },
              { type: "button", id: "report", label: "Report bug", value: "bug" },
            ],
          },
        ],
      };

      const result = cardToWhatsApp(card);

      expect(result.type).toBe("interactive");
      if (result.type !== "interactive") {
        return;
      }

      expect(result.interactive).toEqual({
        type: "button",
        header: {
          type: "text",
          text: "Choose an action",
        },
        body: {
          text: "What would you like to do?",
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: encodeWhatsAppCallbackData("approve"),
                title: "Approve",
              },
            },
            {
              type: "reply",
              reply: {
                id: encodeWhatsAppCallbackData("report", "bug"),
                title: "Report bug",
              },
            },
          ],
        },
      });
    });

    it("truncates cards with more than three buttons to the first three", () => {
      const card: CardElement = {
        type: "card",
        children: [
          {
            type: "actions",
            children: [
              { type: "button", id: "one", label: "One" },
              { type: "button", id: "two", label: "Two" },
              { type: "button", id: "three", label: "Three" },
              { type: "button", id: "four", label: "Four" },
            ],
          },
        ],
      };

      const result = cardToWhatsApp(card);

      expect(result.type).toBe("interactive");
      if (result.type !== "interactive") {
        return;
      }

      expect(result.interactive.action.buttons).toHaveLength(3);
      expect(result.interactive.action.buttons[2]?.reply.id).toBe(
        encodeWhatsAppCallbackData("three"),
      );
    });

    it("truncates long button titles to twenty characters", () => {
      const card: CardElement = {
        type: "card",
        children: [
          {
            type: "actions",
            children: [
              {
                type: "button",
                id: "long",
                label: "This is a very long button title that exceeds the limit",
              },
            ],
          },
        ],
      };

      const result = cardToWhatsApp(card);

      expect(result.type).toBe("interactive");
      if (result.type !== "interactive") {
        return;
      }

      expect(
        result.interactive.action.buttons[0]?.reply.title.length,
      ).toBeLessThanOrEqual(20);
    });

    it("falls back to text for unsupported cards", () => {
      const card: CardElement = {
        type: "card",
        title: "Links only",
        children: [
          {
            type: "actions",
            children: [
              {
                type: "link-button",
                url: "https://example.com",
                label: "Visit",
              },
            ],
          },
        ],
      };

      expect(cardToWhatsApp(card)).toEqual({
        type: "text",
        text: "*Links only*\n\nVisit: https://example.com",
      });
    });
  });

  describe("cardToWhatsAppText", () => {
    it("renders a readable text fallback", () => {
      const card: CardElement = {
        type: "card",
        title: "Order #1234",
        subtitle: "Ready for review",
        children: [
          {
            type: "fields",
            children: [{ type: "field", label: "Status", value: "Pending" }],
          },
        ],
      };

      expect(cardToWhatsAppText(card)).toBe(
        "*Order #1234*\nReady for review\n\n*Status:* Pending",
      );
    });
  });

  describe("callback data", () => {
    it("encodes and decodes action IDs with optional values", () => {
      const encoded = encodeWhatsAppCallbackData("report", "bug");

      expect(encoded).toBe('chat:{"a":"report","v":"bug"}');
      expect(decodeWhatsAppCallbackData(encoded)).toEqual({
        actionId: "report",
        value: "bug",
      });
    });

    it("passes through non-prefixed callback IDs", () => {
      expect(decodeWhatsAppCallbackData("priority_high")).toEqual({
        actionId: "priority_high",
        value: "priority_high",
      });
    });
  });
});
