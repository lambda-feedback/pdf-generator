import { describe, it, expect } from "vitest";
import { PdcTs } from "pdc-ts";
import { fixInlineLatex } from "./utils";

// Integration tests — require Pandoc to be installed on PATH
const toLatex = (markdown: string, format = "markdown") =>
  new PdcTs().Execute({
    from: format,
    to: "latex",
    outputToFile: false,
    sourceText: markdown,
  });

describe("Pandoc markdown → LaTeX output", () => {
  describe("markdown constructs", () => {
    it("converts a heading to \\section", async () => {
      const latex = await toLatex("# My Title");
      expect(latex).toContain("\\section{My Title}");
    });

    it("converts bold to \\textbf", async () => {
      const latex = await toLatex("**bold text**");
      expect(latex).toContain("\\textbf{bold text}");
    });

    it("converts italic to \\emph", async () => {
      const latex = await toLatex("*italic*");
      expect(latex).toContain("\\emph{italic}");
    });
  });

  describe("math handling", () => {
    it("converts inline math to \\(...\\) in LaTeX output", async () => {
      const latex = await toLatex("The value is $x^2 + 1$.");
      expect(latex).toContain("\\(x^2 + 1\\)");
    });

    it("converts display math to \\[...\\]", async () => {
      const latex = await toLatex("$$\\int_{0}^{1} x\\, dx$$");
      expect(latex).toContain("\\[");
      expect(latex).toContain("\\int_{0}^{1}");
    });
  });

  describe("implicit_figures extension", () => {
    const imageMd = "![A caption](image.png)";

    it("wraps images in a figure environment when enabled", async () => {
      const latex = await toLatex(imageMd, "markdown+implicit_figures");
      expect(latex).toContain("\\begin{figure}");
    });

    it("does not wrap images in a figure environment when disabled", async () => {
      const latex = await toLatex(imageMd, "markdown-implicit_figures");
      expect(latex).not.toContain("\\begin{figure}");
    });
  });

  describe("fixInlineLatex preprocessing", () => {
    it("trailing space in math is fixed and Pandoc accepts the result", async () => {
      const fixed = fixInlineLatex("$\\frac{T}{T_0} $");
      const latex = await toLatex(fixed);
      expect(latex).toContain("\\frac");
    });

    it("leading space in math is fixed and Pandoc accepts the result", async () => {
      const fixed = fixInlineLatex("$ \\frac{T}{T_0}$");
      const latex = await toLatex(fixed);
      expect(latex).toContain("\\frac");
    });

    it("legacy \\[...\\] delimiters become inline math in LaTeX output", async () => {
      // fixInlineLatex turns \[...\] into $...$ (inline math in markdown);
      // Pandoc 3.x then emits \(...\) in LaTeX
      const fixed = fixInlineLatex("\\[x + y\\]");
      const latex = await toLatex(fixed);
      expect(latex).toContain("\\(x + y\\)");
    });
  });
});
