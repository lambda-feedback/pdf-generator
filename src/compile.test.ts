import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { PdcTs } from "pdc-ts";

// End-to-end compile tests — require xelatex (TeX Live) and Pandoc on PATH.
// These run the full production pipeline: markdown → Pandoc + template.latex → xelatex → PDF.
// They are intentionally slow (~5-15s per compile).

// Absolute paths so Pandoc can locate the templates regardless of its working directory
const DEFAULT_TEMPLATE = path.resolve(__dirname, "templates/default.latex");
const CJK_TEMPLATE = path.resolve(__dirname, "templates/cjk.latex");

const pendingPdfs: string[] = [];

const compileToPdf = async (markdown: string, id: string, template: string = DEFAULT_TEMPLATE) => {
  const tmpPath = `/tmp/compile-test-${id}.pdf`;
  pendingPdfs.push(tmpPath);
  await new PdcTs().Execute({
    from: "markdown",
    to: "latex",
    pandocArgs: ["--pdf-engine=xelatex", `--template=${template}`],
    spawnOpts: { argv0: "+RTS -M512M -RTS" },
    outputToFile: true,
    sourceText: markdown,
    destFilePath: tmpPath,
  });
  return tmpPath;
};

const extractText = (pdfPath: string) =>
  execSync(`pdftotext "${pdfPath}" -`).toString();

afterEach(() => {
  for (const p of pendingPdfs.splice(0)) {
    try { fs.rmSync(p, { force: true }); } catch { /* ignore */ }
  }
});

describe("PDF compile (end-to-end pipeline)", () => {
  it(
    "renders heading and paragraph text correctly",
    async () => {
      const pdf = await compileToPdf(
        "# Hello\n\nThis is a test document.",
        "basic"
      );
      const text = extractText(pdf);
      expect(text).toContain("Hello");
      expect(text).toContain("This is a test document");
    },
    { timeout: 60_000 }
  );

  it(
    "renders inline and display math without compilation errors",
    async () => {
      const pdf = await compileToPdf(
        "The value is $x^2 + 1$.\n\n$$\\int_0^1 x\\, dx = \\frac{1}{2}$$",
        "math"
      );
      // pdftotext cannot reliably extract math glyph sequences, so we verify
      // the surrounding prose appears and the file is non-trivially sized
      const text = extractText(pdf);
      expect(text).toContain("The value is");
      expect(fs.statSync(pdf).size).toBeGreaterThan(5000);
    },
    { timeout: 60_000 }
  );

  it(
    "renders Unicode Greek letters in prose correctly",
    async () => {
      const pdf = await compileToPdf(
        "Unicode Greek: α, β, γ, Δ, Σ.\n\nDiscriminant $\\Delta = b^2 - 4ac$ where $\\alpha, \\beta \\in \\mathbb{R}$.\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2}\\, dx = \\sqrt{\\pi}$$",
        "unicode"
      );
      const text = extractText(pdf);
      // Greek letters used as prose text should survive rendering
      expect(text).toContain("α");
      expect(text).toContain("β");
      expect(text).toContain("Δ");
      expect(text).toContain("Σ");
    },
    { timeout: 60_000 }
  );

  it(
    "renders Korean text via the cjk template",
    async () => {
      const pdf = await compileToPdf(
        "# 수학 문서\n\n이차 방정식의 판별식은 $\\Delta = b^2 - 4ac$ 입니다.",
        "korean",
        CJK_TEMPLATE
      );
      const text = extractText(pdf);
      // pdftotext collapses inter-word spacing between Hangul syllable blocks,
      // so match the individual words rather than the spaced phrase
      expect(text).toContain("수학");
      expect(text).toContain("문서");
      expect(text).toContain("판별식");
    },
    { timeout: 60_000 }
  );
});