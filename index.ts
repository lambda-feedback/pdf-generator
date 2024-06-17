import { APIGatewayEvent, Context, APIGatewayProxyResult } from "aws-lambda";
import * as fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PdcTs } from "pdc-ts";
import { deleteFile, errorRefiner } from "./src/utils";
import { z } from "zod";

const TypeOfFileSchema = z.enum(["PDF", "TEX", "ALL"]);

export const schema = z.object({
  userId: z.string(),
  markdown: z.string(),
  setNumber: z.number(),
  moduleSlug: z.string(),
  typeOfFile: TypeOfFileSchema,
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

  const region = "eu-west-2";
  const s3Client = new S3Client({ region });
  const s3Bucket = process.env.PUBLIC_S3_BUCKET;

  const pdcTs = new PdcTs();

  const markdown = requestData.markdown;

  // Generate file
  const generateFile = async (pandocArgs: string[], destFilePath: string) => {
    try {
      await pdcTs.Execute({
        from: "markdown-implicit_figures", // pandoc source format (disabling the implicit_figures extension to remove all image captions)
        to: "latex", // pandoc output format
        pandocArgs,
        spawnOpts: { argv0: "+RTS -M512M -RTS" },
        outputToFile: true, // Controls whether the output will be returned as a string or written to a file
        sourceText: markdown, // Use this if your input is a string. If you set this, the file input will be ignored
        destFilePath,
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
        pandocArgs,
        outputToFile: false, // Controls whether the output will be returned as a string or written to a file
        sourceText: markdown, // Use this if your input is a string. If you set this, the file input will be ignored
        destFilePath,
      });

      // Find the offending text from the error message:
      e = errorRefiner(String(e), TeXoutput, false);

      return {
        statusCode: 500,
        body: JSON.stringify({ e }),
      };
    }
  };

  const saveFileToS3 = async (localPathPDF: string, s3Path: string) => {
    // Save PDF file to S3 bucket
    try {
      const fileStream = fs.createReadStream(localPathPDF);
      const params = {
        Bucket: s3Bucket,
        Key: s3Path,
        Body: fileStream,
      };

      const command = new PutObjectCommand(params);
      await s3Client.send(command);
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
      deleteFile(localPathPDF);
    }
  };

  // These are variables for PDF file only, we need them here for the URL (always points to the PDF)
  const filenamePDF = `${requestData.moduleSlug}_S${humanSetNumber}_${timestamp}.pdf`;
  const localPathPDF = `/tmp/${filenamePDF}`;
  const s3PathPDF = `${requestData.userId}/${filenamePDF}`;
  const url = `https://${s3Bucket}.s3.${region}.amazonaws.com/${s3PathPDF}`;

  if (requestData.typeOfFile === "PDF" || requestData.typeOfFile === "ALL") {
    const generatePDFResult = await generateFile(
      ["--pdf-engine=pdflatex", `--template=./template.latex`],
      localPathPDF
    );

    if (generatePDFResult?.statusCode) {
      return generatePDFResult;
    }

    await saveFileToS3(localPathPDF, s3PathPDF);
  }

  if (requestData.typeOfFile === "PDF" || requestData.typeOfFile === "ALL") {
    const filenameTEX = `${requestData.moduleSlug}_S${humanSetNumber}_${timestamp}.tex`;
    const localPathTEX = `/tmp/${filenameTEX}`;

    await generateFile([`--template=./template.latex`], localPathTEX);

    const s3PathTEX = `${requestData.userId}/${filenameTEX}`;

    await saveFileToS3(localPathTEX, s3PathTEX);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      url,
    }),
  };
};
