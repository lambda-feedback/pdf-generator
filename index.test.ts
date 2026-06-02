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
