import { describe, expect, it } from "vitest";
import { KapsoFormatConverter } from "./format-converter.js";
import { Card } from "chat";

describe("KapsoFormatConverter", () => {
  const converter = new KapsoFormatConverter();

  describe("toAst", () => {
    it("parses plain text", () => {
      const ast = converter.toAst("Hello world");

      expect(ast.type).toBe("root");
      expect(ast.children.length).toBeGreaterThan(0);
    });

    it("parses WhatsApp bold as standard bold", () => {
      const ast = converter.toAst("*bold text*");

      expect(ast.type).toBe("root");
    });

    it("parses WhatsApp strikethrough as standard strikethrough", () => {
      const ast = converter.toAst("~strikethrough~");

      expect(ast.type).toBe("root");
    });

    it("parses italic", () => {
      const ast = converter.toAst("_italic text_");

      expect(ast.type).toBe("root");
    });

    it("does not merge bold spans across newlines", () => {
      const ast = converter.toAst("*bold1*\nsome text\n*bold2*");
      const result = converter.fromAst(ast);

      expect(result).toContain("*bold1*");
      expect(result).toContain("*bold2*");
    });

    it("parses lists", () => {
      const ast = converter.toAst("- item 1\n- item 2\n- item 3");

      expect(ast.type).toBe("root");
    });
  });

  describe("fromAst", () => {
    it("stringifies a simple AST", () => {
      const ast = converter.toAst("Hello world");

      expect(converter.fromAst(ast)).toContain("Hello world");
    });

    it("converts standard bold to WhatsApp bold", () => {
      const ast = converter.toAst("**bold text**");
      const result = converter.fromAst(ast);

      expect(result).toContain("*bold text*");
      expect(result).not.toContain("**bold text**");
    });

    it("converts standard strikethrough to WhatsApp style", () => {
      const ast = converter.toAst("~~strikethrough~~");
      const result = converter.fromAst(ast);

      expect(result).toContain("~strikethrough~");
      expect(result).not.toContain("~~strikethrough~~");
    });

    it("preserves escaped asterisks and tildes as literals", () => {
      const ast = converter.toAst("a \\* b and c \\~ d");
      const result = converter.fromAst(ast);

      expect(result).toContain("\\*");
      expect(result).toContain("\\~");
    });

    it("converts standard italic to WhatsApp underscore italic", () => {
      const result = converter.renderPostable({ markdown: "_italic text_" });

      expect(result).toContain("_italic text_");
      expect(result).not.toContain("*italic text*");
    });

    it("handles bold and italic together", () => {
      const result = converter.renderPostable({
        markdown: "**bold** and _italic_",
      });

      expect(result).toContain("*bold*");
      expect(result).toContain("_italic_");
    });

    it("converts headings to bold text", () => {
      const ast = converter.toAst("# Main heading");
      const result = converter.fromAst(ast);

      expect(result).toContain("*Main heading*");
      expect(result).not.toContain("#");
    });

    it("flattens bold inside headings to avoid triple asterisks", () => {
      const result = converter.renderPostable({
        markdown: "## **Choose React if:**",
      });

      expect(result).toContain("*Choose React if:*");
      expect(result).not.toContain("***");
    });

    it("handles headings with mixed text and bold", () => {
      const result = converter.renderPostable({
        markdown: "# The Honest Answer: **It Depends!**",
      });

      expect(result).toContain("*The Honest Answer: It Depends!*");
      expect(result).not.toContain("**");
    });

    it("converts thematic breaks to text separators", () => {
      const ast = converter.toAst("above\n\n---\n\nbelow");
      const result = converter.fromAst(ast);

      expect(result).toContain("---");
      expect(result).toContain("above");
      expect(result).toContain("below");
    });

    it("converts tables to code blocks", () => {
      const ast = converter.toAst("| A | B |\n| --- | --- |\n| 1 | 2 |");
      const result = converter.fromAst(ast);

      expect(result).toContain("```");
    });
  });

  describe("renderPostable", () => {
    it("renders a plain string", () => {
      expect(converter.renderPostable("Hello world")).toBe("Hello world");
    });

    it("renders a raw message", () => {
      expect(converter.renderPostable({ raw: "raw content" })).toBe(
        "raw content",
      );
    });

    it("renders a markdown message", () => {
      expect(converter.renderPostable({ markdown: "**bold** text" })).toContain(
        "*bold* text",
      );
    });

    it("renders an AST message", () => {
      const ast = converter.toAst("Hello from AST");

      expect(converter.renderPostable({ ast })).toContain("Hello from AST");
    });

    it("uses the base fallback for card messages", () => {
      const result = converter.renderPostable(
        Card({
          title: "Status",
        }),
      );

      expect(result).toContain("Status");
    });

    it("converts a complex markdown response", () => {
      const markdown = [
        "# The Answer: **It Depends!**",
        "",
        "There's no universal *better* choice.",
        "",
        "## **Choose React if:**",
        "- Building **large-scale** apps",
        "- Need the biggest *ecosystem*",
        "",
        "---",
        "",
        "**All three are excellent.** Learn *React* first!",
      ].join("\n");

      const result = converter.renderPostable({ markdown });

      expect(result).toContain("*The Answer: It Depends!*");
      expect(result).toContain("_better_");
      expect(result).toContain("*Choose React if:*");
      expect(result).toContain("*large-scale*");
      expect(result).toContain("---");
      expect(result).toContain("*All three are excellent.*");
    });
  });
});
