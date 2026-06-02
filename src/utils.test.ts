import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "fs";
import { fixInlineLatex, errorRefiner, deleteFile } from "./utils";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, rm: vi.fn() };
});

describe("fixInlineLatex", () => {
  it("returns unchanged text when no $ signs are present", () => {
    expect(fixInlineLatex("hello world")).toBe("hello world");
  });

  it("removes trailing whitespace before closing $", () => {
    expect(fixInlineLatex("$\\frac{T}{T_0} $")).toBe("$\\frac{T}{T_0}$");
  });

  it("removes leading whitespace after opening $", () => {
    expect(fixInlineLatex("$ \\frac{T}{T_0}$")).toBe("$\\frac{T}{T_0}$");
  });

  it("replaces \\[...\\] delimiters with $", () => {
    expect(fixInlineLatex("\\[x + y\\]")).toBe("$x + y$");
  });

  it("replaces \\(...\\) delimiters with $", () => {
    expect(fixInlineLatex("\\(x\\)")).toBe("$x$");
  });

  it("fixes both legacy delimiters and adjacent whitespace", () => {
    expect(fixInlineLatex("\\[x \\]")).toBe("$x$");
  });
});

describe("errorRefiner", () => {
  it("returns fallback message when error contains no line number", () => {
    const result = errorRefiner("Pandoc: some undefined error", "\\documentclass{article}");
    expect(result).toContain("Further information could not be ascertained");
  });

  it("identifies error location as 'start' when no labels exist in TeX", () => {
    const texContent = "line1\nline2\nline3\nline4\nline5";
    const result = errorRefiner("! Error\nl.3 bad token", texContent);
    expect(result).toContain("Qstart");
  });

  it("identifies error in labelled section when \\lambdalabel is present", () => {
    const texContent = "line1\n\\lambdalabel{Q3}\nline3\nline4\nline5";
    const result = errorRefiner("! Missing $\nl.4 bad token", texContent);
    expect(result).toContain("Q3");
  });

  it("includes debug info in output when showDebug is true", () => {
    const result = errorRefiner("! Error\nl.1 bad", "some tex content", true);
    expect(result).toContain("errorLine:");
  });

  it("handles nearBeginning case by incrementing section index", () => {
    // Error whose offending string is the label itself — section index should still resolve to Q5
    const texContent = "line1\n\\lambdalabel{Q5}\nline3\nline4\nline5";
    const result = errorRefiner("! Error\nl.2 \\lambdalabel{Q5}", texContent);
    expect(result).toContain("Q5");
  });
});

describe("deleteFile", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls fs.rm with the specified file path", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.rm as any).mockImplementation((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") cb(null);
    });
    deleteFile("/tmp/test.pdf");
    expect(fs.rm).toHaveBeenCalledWith("/tmp/test.pdf", expect.any(Function));
  });

  it("logs an error when fs.rm callback receives an error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.rm as any).mockImplementation((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") cb(new Error("ENOENT: no such file"));
    });
    deleteFile("/tmp/nonexistent.pdf");
    expect(errorSpy).toHaveBeenCalled();
  });
});
