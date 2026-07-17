import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, rm: vi.fn(), createReadStream: vi.fn() };
});

vi.mock("pdc-ts", () => ({
  PdcTs: vi.fn().mockImplementation(() => ({
    Execute: vi.fn().mockResolvedValue(""),
  })),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn().mockImplementation((params: unknown) => params),
}));

import { schema, handler } from "./index";
import { PdcTs } from "pdc-ts";

describe("schema", () => {
  it("validates a minimal valid PDF request", () => {
    const data = [{ userId: "u1", fileName: "doc", typeOfFile: "PDF", markdown: "# Hello" }];
    expect(schema.safeParse(data).success).toBe(true);
  });

  it("validates a TEX request with implicitFigures", () => {
    const data = [{ userId: "u1", fileName: "doc", typeOfFile: "TEX", markdown: "text", implicitFigures: true }];
    expect(schema.safeParse(data).success).toBe(true);
  });

  it("rejects request missing userId", () => {
    const data = [{ fileName: "doc", typeOfFile: "PDF", markdown: "text" }];
    expect(schema.safeParse(data).success).toBe(false);
  });

  it("rejects invalid typeOfFile value", () => {
    const data = [{ userId: "u1", fileName: "doc", typeOfFile: "DOCX", markdown: "text" }];
    expect(schema.safeParse(data).success).toBe(false);
  });

  it("rejects request missing markdown", () => {
    const data = [{ userId: "u1", fileName: "doc", typeOfFile: "PDF" }];
    expect(schema.safeParse(data).success).toBe(false);
  });

  it("rejects a non-array input", () => {
    const data = { userId: "u1", fileName: "doc", typeOfFile: "PDF", markdown: "text" };
    expect(schema.safeParse(data).success).toBe(false);
  });

  it("validates a request with a variables map", () => {
    const data = [{ userId: "u1", fileName: "doc", typeOfFile: "PDF", markdown: "text", variables: { lang: "ko", CJKmainfont: "Noto Sans CJK KR" } }];
    expect(schema.safeParse(data).success).toBe(true);
  });

  it("rejects variables with non-string values", () => {
    const data = [{ userId: "u1", fileName: "doc", typeOfFile: "PDF", markdown: "text", variables: { lang: 42 } }];
    expect(schema.safeParse(data).success).toBe(false);
  });

  it("validates a request with template \"default\"", () => {
    const data = [{ userId: "u1", fileName: "doc", typeOfFile: "PDF", markdown: "text", template: "default" }];
    expect(schema.safeParse(data).success).toBe(true);
  });

  it("validates a request with template \"cjk\"", () => {
    const data = [{ userId: "u1", fileName: "doc", typeOfFile: "PDF", markdown: "text", template: "cjk" }];
    expect(schema.safeParse(data).success).toBe(true);
  });

  it("rejects an unknown template value", () => {
    const data = [{ userId: "u1", fileName: "doc", typeOfFile: "PDF", markdown: "text", template: "korean" }];
    expect(schema.safeParse(data).success).toBe(false);
  });
});

describe("handler", () => {
  beforeEach(() => {
    process.env.PUBLIC_S3_BUCKET = "test-bucket";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.createReadStream as any).mockReturnValue({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.rm as any).mockImplementation((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") cb(null);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when event is null", async () => {
    const result = await handler(null as any);
    expect(result.statusCode).toBe(400);
  });

  it("returns 400 when payload does not match schema", async () => {
    const result = await handler({ invalid: true } as any);
    expect(result.statusCode).toBe(400);
  });

  it("returns 200 with a URL for a valid PDF request", async () => {
    const event = [{ userId: "user1", fileName: "test-doc", typeOfFile: "PDF", markdown: "# Hello" }];
    const result = await handler(event as any);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as { url: string };
    expect(body.url).toContain("test-doc.pdf");
    expect(body.url).toContain("test-bucket");
  });

  it("returns 200 for a valid TEX request", async () => {
    const event = [{ userId: "user1", fileName: "test-doc", typeOfFile: "TEX", markdown: "# Hello" }];
    const result = await handler(event as any);
    expect(result.statusCode).toBe(200);
  });

  it("passes variables as --variable flags to Pandoc", async () => {
    const executeMock = vi.fn().mockResolvedValue("");
    vi.mocked(PdcTs).mockImplementationOnce(() => ({ Execute: executeMock }) as any);

    const event = [{ userId: "user1", fileName: "test-doc", typeOfFile: "TEX", markdown: "# Hello", variables: { lang: "ko", CJKmainfont: "Noto Sans CJK KR" } }];
    await handler(event as any);

    const calledArgs: string[] = executeMock.mock.calls[0]?.[0]?.pandocArgs ?? [];
    expect(calledArgs).toContain("--variable=lang:ko");
    expect(calledArgs).toContain("--variable=CJKmainfont:Noto Sans CJK KR");
  });

  it("uses the default template when template is omitted", async () => {
    const executeMock = vi.fn().mockResolvedValue("");
    vi.mocked(PdcTs).mockImplementationOnce(() => ({ Execute: executeMock }) as any);

    const event = [{ userId: "user1", fileName: "test-doc", typeOfFile: "TEX", markdown: "# Hello" }];
    await handler(event as any);

    const calledArgs: string[] = executeMock.mock.calls[0]?.[0]?.pandocArgs ?? [];
    expect(calledArgs).toContain("--template=./templates/default.latex");
  });

  it("uses the cjk template when template is \"cjk\"", async () => {
    const executeMock = vi.fn().mockResolvedValue("");
    vi.mocked(PdcTs).mockImplementationOnce(() => ({ Execute: executeMock }) as any);

    const event = [{ userId: "user1", fileName: "test-doc", typeOfFile: "TEX", markdown: "# Hello", template: "cjk" }];
    await handler(event as any);

    const calledArgs: string[] = executeMock.mock.calls[0]?.[0]?.pandocArgs ?? [];
    expect(calledArgs).toContain("--template=./templates/cjk.latex");
  });

  it("returns 500 when Pandoc execution fails", async () => {
    vi.mocked(PdcTs).mockImplementationOnce(() => ({
      Execute: vi.fn()
        .mockRejectedValueOnce(new Error("Pandoc error l.1 bad token"))
        .mockResolvedValueOnce("line1\nline2\nline3"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    const event = [{ userId: "user1", fileName: "test-doc", typeOfFile: "PDF", markdown: "# Hello" }];
    const result = await handler(event as any);
    expect(result.statusCode).toBe(500);
  });
});
