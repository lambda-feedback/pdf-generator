import { APIGatewayEvent, Context, APIGatewayProxyResult } from "aws-lambda";
import * as fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PdcTs } from "pdc-ts";
import { deleteFile, errorRefiner } from "./src/utils";
import { z } from "zod";

export const schema = z.object({
  userId: z.string(),
  markdown: z.string(),
  setNumber: z.number(),
  moduleSlug: z.string(),
});

export const handler = async function (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> {
  if (!event || event === null) {
    console.error("request:", event);
    return {
      statusCode: 400,
      body: "The request does not contain payload",
    };
  }

  const parsed = schema.safeParse(event);

  if (!parsed.success) {
    console.error("The request does not contain correct payload:", event);
    return {
      statusCode: 400,
      body: "The request does not contain correct payload",
    };
  }

  const requestData = parsed.data;
  const humanSetNumber = requestData.setNumber + 1;
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.]/g, "")
    .slice(0, 14);
  const filename = `${requestData.moduleSlug}_S${humanSetNumber}_${timestamp}.pdf`;

  const localPath = `/tmp/${filename}`;
  const s3Path = `${requestData.userId}/${filename}`;
  let url: string | undefined;

  const pdcTs = new PdcTs();

  const markdown = requestData.markdown;
  try {
    await pdcTs.Execute({
      from: "markdown-implicit_figures", // pandoc source format (disabling the implicit_figures extension to remove all image captions)
      to: "latex", // pandoc output format
      pandocArgs: ["--pdf-engine=pdflatex", `--template=./template.latex`],
      spawnOpts: { argv0: "+RTS -M512M -RTS" },
      outputToFile: true, // Controls whether the output will be returned as a string or written to a file
      sourceText: markdown, // Use this if your input is a string. If you set this, the file input will be ignored
      destFilePath: localPath,
    });
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error(e.message);
    } else {
      console.error(e);
    }

    const TeXoutput = await pdcTs.Execute({
      from: "markdown-implicit_figures", // pandoc source format (disabling the implicit_figures extension to remove all image captions)
      to: "latex", // pandoc output format
      pandocArgs: ["--pdf-engine=pdflatex", `--template=./template.latex`],
      outputToFile: false, // Controls whether the output will be returned as a string or written to a file
      sourceText: markdown, // Use this if your input is a string. If you set this, the file input will be ignored
    });

    // Find the offending text from the error message:
    e = errorRefiner(String(e), TeXoutput, false);

    return {
      statusCode: 500,
      body: JSON.stringify({ e }),
    };
  }

  try {
    const region = "eu-west-2";
    const fileStream = fs.createReadStream(localPath);
    const s3Client = new S3Client({ region });
    const s3Bucket = process.env.PUBLIC_S3_BUCKET;
    const params = {
      Bucket: s3Bucket,
      Key: s3Path,
      Body: fileStream,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    url = `https://${s3Bucket}.s3.${region}.amazonaws.com/${s3Path}`;
  } catch (e: unknown) {
    console.error("S3 upload failed");
    if (e instanceof Error) {
      console.error(e.message);
      return {
        statusCode: 500,
        body: e.message,
      };
    } else {
      console.error(e);
      return {
        statusCode: 500,
        body: "S3 Upload failed",
      };
    }
  } finally {
    // cleanup
    deleteFile(localPath);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      url,
    }),
  };
};
