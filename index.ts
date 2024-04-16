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
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  if (!event.body || event.body === null) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "The request does not contain payload",
      }),
    };
  }

  const parsed = schema.safeParse(JSON.parse(event.body));

  if (!parsed.success) {
    console.error("The request does not contain correct payload:", event.body);
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "The request does not contain correct payload",
      }),
    };
  }

  const requestData = parsed.data;

  console.log("Request data:", requestData);
  const humanSetNumber = requestData.setNumber + 1;

  const filename = `${requestData.moduleSlug}_S${humanSetNumber}_${new Date()
    .toISOString()
    .replace(/[-:T.]/g, "")
    .slice(0, 14)}.pdf`; // Note: set name not a slug so not used.

  const localPath = `/tmp/${filename}`;
  const s3Path = `${requestData.userId}/${filename}`;
  let url: string | undefined;

  const pdcTs = new PdcTs();

  //const markdown = "# Heading\n\nThis is some **bold** text.";
  const markdown = requestData.markdown;
  console.log("Markdown:", markdown);
  try {
    await pdcTs.Execute({
      from: "markdown-implicit_figures", // pandoc source format (disabling the implicit_figures extension to remove all image captions)
      //from: "markdown",
      to: "latex", // pandoc output format
      pandocArgs: ["--pdf-engine=pdflatex", `--template=./template.latex`],
      spawnOpts: { argv0: "+RTS -M512M -RTS" },
      outputToFile: true, // Controls whether the output will be returned as a string or written to a file
      sourceText: markdown, // Use this if your input is a string. If you set this, the file input will be ignored
      destFilePath: localPath,
    });
  } catch (e: unknown) {
    console.error("PDF generation failed");
    if (e instanceof Error) {
      console.error(e.message);
    } else {
      console.error(e);
    }

    const TeXoutput = await pdcTs.Execute({
      from: "markdown-implicit_figures", // pandoc source format (disabling the implicit_figures extension to remove all image captions)
      to: "latex", // pandoc output format
      pandocArgs: ["--pdf-engine=xelatex", `--template=./template.latex`],
      outputToFile: false, // Controls whether the output will be returned as a string or written to a file
      sourceText: markdown, // Use this if your input is a string. If you set this, the file input will be ignored
      destFilePath: localPath,
    });

    // Find the offending text from the error message:
    e = errorRefiner(String(e), TeXoutput, false);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: e,
      }),
    };
  }

  try {
    const fileStream = fs.createReadStream(localPath);
    const s3Client = new S3Client({ region: "eu-west-2" });
    const params = {
      Bucket: "lambda-feedback-staging-frontend-client-bucket",
      Key: s3Path,
      Body: fileStream,
    };
    const command = new PutObjectCommand(params);
    const response = await s3Client.send(command);

    //url = `https://${this.configurationService.PUBLIC_S3_BUCKET}.s3.${this.configurationService.PUBLIC_S3_BUCKET_REGION}.amazonaws.com/${s3Path}`;
    url = `https://lambda-feedback-staging-frontend-client-bucket.s3.eu-west-2.amazonaws.com/${s3Path}`;
    console.log("url:", url);
  } catch (e: unknown) {
    console.error("S3 upload failed");
    if (e instanceof Error) {
      console.error(e.message);
    } else {
      console.error(e);
    }
    throw e;
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
