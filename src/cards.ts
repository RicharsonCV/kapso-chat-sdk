import type {
  ActionsElement,
  ButtonElement,
  CardChild,
  CardElement,
  FieldsElement,
  TextElement,
} from "chat";

const CALLBACK_DATA_PREFIX = "chat:";
const MAX_REPLY_BUTTONS = 3;
const MAX_BUTTON_TITLE_LENGTH = 20;
const MAX_BODY_LENGTH = 1024;
const MAX_HEADER_LENGTH = 60;

interface KapsoCardActionPayload {
  a: string;
  v?: string;
}

export interface KapsoInteractiveMessage {
  type: "button";
  header?: {
    type: "text";
    text: string;
  };
  body: {
    text: string;
  };
  action: {
    buttons: Array<{
      type: "reply";
      reply: {
        id: string;
        title: string;
      };
    }>;
  };
}

export type KapsoCardResult =
  | {
      type: "interactive";
      interactive: KapsoInteractiveMessage;
    }
  | {
      type: "text";
      text: string;
    };

export function encodeWhatsAppCallbackData(
  actionId: string,
  value?: string,
): string {
  const payload: KapsoCardActionPayload = { a: actionId };

  if (typeof value === "string") {
    payload.v = value;
  }

  return `${CALLBACK_DATA_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeWhatsAppCallbackData(data?: string): {
  actionId: string;
  value: string | undefined;
} {
  if (!data) {
    return { actionId: "whatsapp_callback", value: undefined };
  }

  if (!data.startsWith(CALLBACK_DATA_PREFIX)) {
    return { actionId: data, value: data };
  }

  try {
    const decoded = JSON.parse(
      data.slice(CALLBACK_DATA_PREFIX.length),
    ) as KapsoCardActionPayload;

    if (typeof decoded.a === "string" && decoded.a.length > 0) {
      return {
        actionId: decoded.a,
        value: typeof decoded.v === "string" ? decoded.v : undefined,
      };
    }
  } catch {
    // Fall through to passthrough behavior.
  }

  return { actionId: data, value: data };
}

export function cardToWhatsApp(card: CardElement): KapsoCardResult {
  const actions = findActions(card.children);
  const actionButtons = actions ? extractReplyButtons(actions) : null;

  if (actionButtons && actionButtons.length > 0) {
    const bodyText = buildBodyText(card);

    return {
      type: "interactive",
      interactive: {
        type: "button",
        ...(card.title
          ? {
              header: {
                type: "text" as const,
                text: truncate(card.title, MAX_HEADER_LENGTH),
              },
            }
          : {}),
        body: {
          text: truncate(bodyText || "Please choose an option", MAX_BODY_LENGTH),
        },
        action: {
          buttons: actionButtons.map((button) => ({
            type: "reply" as const,
            reply: {
              id: encodeWhatsAppCallbackData(button.id, button.value),
              title: truncate(button.label, MAX_BUTTON_TITLE_LENGTH),
            },
          })),
        },
      },
    };
  }

  return {
    type: "text",
    text: cardToWhatsAppText(card),
  };
}

export function cardToWhatsAppText(card: CardElement): string {
  const lines: string[] = [];

  if (card.title) {
    lines.push(`*${escapeWhatsApp(card.title)}*`);
  }

  if (card.subtitle) {
    lines.push(escapeWhatsApp(card.subtitle));
  }

  if ((card.title || card.subtitle) && card.children.length > 0) {
    lines.push("");
  }

  if (card.imageUrl) {
    lines.push(card.imageUrl);
    lines.push("");
  }

  for (let index = 0; index < card.children.length; index += 1) {
    const child = card.children[index];
    const childLines = renderChild(child);

    if (childLines.length > 0) {
      lines.push(...childLines);
      if (index < card.children.length - 1) {
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

function renderChild(child: CardChild): string[] {
  switch (child.type) {
    case "text":
      return renderText(child);
    case "fields":
      return renderFields(child);
    case "actions":
      return renderActions(child);
    case "section":
      return child.children.flatMap(renderChild);
    case "image":
      return [child.alt ? `${child.alt}: ${child.url}` : child.url];
    case "divider":
      return ["---"];
    default:
      return [];
  }
}

function renderText(text: TextElement): string[] {
  switch (text.style) {
    case "bold":
      return [`*${escapeWhatsApp(text.content)}*`];
    case "muted":
      return [`_${escapeWhatsApp(text.content)}_`];
    default:
      return [escapeWhatsApp(text.content)];
  }
}

function renderFields(fields: FieldsElement): string[] {
  return fields.children.map(
    (field) =>
      `*${escapeWhatsApp(field.label)}:* ${escapeWhatsApp(field.value)}`,
  );
}

function renderActions(actions: ActionsElement): string[] {
  const buttonTexts = actions.children.map((button) => {
    if (button.type === "link-button") {
      return `${escapeWhatsApp(button.label)}: ${button.url}`;
    }

    return `[${escapeWhatsApp(button.label)}]`;
  });

  return [buttonTexts.join(" | ")];
}

function childToPlainText(child: CardChild): string | null {
  switch (child.type) {
    case "text":
      return child.content;
    case "fields":
      return child.children.map((field) => `${field.label}: ${field.value}`).join("\n");
    case "actions":
      return null;
    case "section":
      return child.children.map(childToPlainText).filter(Boolean).join("\n");
    default:
      return null;
  }
}

function findActions(children: CardChild[]): ActionsElement | null {
  for (const child of children) {
    if (child.type === "actions") {
      return child;
    }

    if (child.type === "section") {
      const nestedActions = findActions(child.children);
      if (nestedActions) {
        return nestedActions;
      }
    }
  }

  return null;
}

function extractReplyButtons(actions: ActionsElement): ButtonElement[] | null {
  const buttons: ButtonElement[] = [];

  for (const child of actions.children) {
    if (child.type === "button" && child.id) {
      buttons.push(child);
    }
  }

  if (buttons.length === 0) {
    return null;
  }

  return buttons.slice(0, MAX_REPLY_BUTTONS);
}

function buildBodyText(card: CardElement): string {
  const parts: string[] = [];

  if (card.subtitle) {
    parts.push(card.subtitle);
  }

  for (const child of card.children) {
    if (child.type === "actions") {
      continue;
    }

    const text = childToPlainText(child);
    if (text) {
      parts.push(text);
    }
  }

  return parts.join("\n");
}

function escapeWhatsApp(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~")
    .replace(/`/g, "\\`");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}\u2026`;
}
