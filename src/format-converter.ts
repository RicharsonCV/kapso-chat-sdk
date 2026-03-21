/**
 * Kapso/WhatsApp format conversion using AST-based parsing.
 *
 * WhatsApp uses a markdown-like format with some differences from standard:
 * - Bold: *text*
 * - Italic: _text_
 * - Strikethrough: ~text~
 * - Monospace: ```text```
 */

import {
  type AdapterPostableMessage,
  BaseFormatConverter,
  type Content,
  isTableNode,
  parseMarkdown,
  type Root,
  stringifyMarkdown,
  tableToAscii,
  walkAst,
} from "chat";

export class KapsoFormatConverter extends BaseFormatConverter {
  /**
   * Convert an AST to WhatsApp-compatible markdown.
   */
  fromAst(ast: Root): string {
    const transformed = walkAst(structuredClone(ast), (node: Content) => {
      // Headings -> bold paragraphs
      if (node.type === "heading") {
        const heading = node as Content & { children: Content[] };
        const children = heading.children.flatMap((child) =>
          child.type === "strong"
            ? (child as Content & { children: Content[] }).children
            : [child],
        );

        return {
          type: "paragraph",
          children: [{ type: "strong", children }],
        } as Content;
      }

      // Thematic breaks -> text separator
      if (node.type === "thematicBreak") {
        return {
          type: "paragraph",
          children: [{ type: "text", value: "---" }],
        } as Content;
      }

      // Tables -> code blocks
      if (isTableNode(node)) {
        return {
          type: "code" as const,
          value: tableToAscii(node),
          lang: undefined,
        } as Content;
      }

      return node;
    });

    // Use _ for emphasis and - for bullets so the only * in output is **strong**
    const markdown = stringifyMarkdown(transformed, {
      emphasis: "_",
      bullet: "-",
    }).trim();

    return this.toKapsoFormat(markdown);
  }

  /**
   * Parse WhatsApp markdown into an AST.
   *
   * Transforms WhatsApp-specific formatting to standard markdown first,
   * then parses with the standard parser.
   */
  toAst(markdown: string): Root {
    const standardMarkdown = this.fromKapsoFormat(markdown);
    return parseMarkdown(standardMarkdown);
  }

  /**
   * Render a postable message to WhatsApp-compatible text.
   */
  override renderPostable(message: AdapterPostableMessage): string {
    if (typeof message === "string") {
      return message;
    }

    if ("raw" in message) {
      return message.raw;
    }

    if ("markdown" in message) {
      return this.fromMarkdown(message.markdown);
    }

    if ("ast" in message) {
      return this.fromAst(message.ast);
    }

    return super.renderPostable(message);
  }

  /**
   * Convert remaining standard markdown markers to WhatsApp format.
   * The stringifier already outputs _italic_ and - bullets.
   * This only converts **bold** -> *bold* and ~~strike~~ -> ~strike~.
   */
  private toKapsoFormat(text: string): string {
    let result = text;
    // Convert **bold** -> *bold*
    result = result.replace(/\*\*(.+?)\*\*/g, "*$1*");
    // Convert ~~strike~~ -> ~strike~
    result = result.replace(/~~(.+?)~~/g, "~$1~");
    return result;
  }

  /**
   * Convert WhatsApp format to standard markdown.
   * Converts single-asterisk bold to double-asterisk bold,
   * and single-tilde strikethrough to double-tilde strikethrough.
   *
   * Careful not to convert _italic_ (which is the same in both formats).
   */
  private fromKapsoFormat(text: string): string {
    // Convert *bold* to **bold** (single * not preceded/followed by *, no newlines)
    let result = text.replace(
      /(?<!\*)\*(?!\*)([^\n*]+?)(?<!\*)\*(?!\*)/g,
      "**$1**",
    );
    // Convert ~strike~ to ~~strike~~ (single ~ not preceded/followed by ~, no newlines)
    result = result.replace(/(?<!~)~(?!~)([^\n~]+?)(?<!~)~(?!~)/g, "~~$1~~");
    return result;
  }
}
