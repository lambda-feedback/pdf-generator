import { APIGatewayEvent, Context, APIGatewayProxyResult } from "aws-lambda";
import * as fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PdcTs } from "pdc-ts";
import { deleteFile, errorRefiner } from "./src/utils";
import { z } from "zod";

const TypeOfFileSchema = z.enum(["PDF", "TEX"]);

export const schema = z.array(
  z.object({
    userId: z.string(),
    fileName: z.string(),
    typeOfFile: TypeOfFileSchema,
    markdown: z.string(),
  })
);

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

  // add here env variables

  const requestData = parsed.data;

  const region = "eu-west-2";
  const s3Client = new S3Client({ region });
  const s3Bucket = process.env.PUBLIC_S3_BUCKET;

  const pdcTs = new PdcTs();

  // Generate file
  const generateFile = async (
    pandocArgs: string[],
    destFilePath: string,
    markdown: string
  ) => {
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
      console.error("File generation failed:", destFilePath);
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

  let url = "";
  for (let eachRequestData of requestData) {
    const markdown = eachRequestData.markdown;

    switch (eachRequestData.typeOfFile) {
      case "PDF":
        const filenamePDF = `${eachRequestData.fileName}.pdf`;
        const localPathPDF = `/tmp/${filenamePDF}`;
        const generatePDFResult = await generateFile(
          ["--pdf-engine=xelatex", `--template=./template.latex`],
          localPathPDF,
          markdown
        );

        if (generatePDFResult?.statusCode) {
          return generatePDFResult;
        }
        const s3PathPDF = `${eachRequestData.userId}/${filenamePDF}`;
        await saveFileToS3(localPathPDF, s3PathPDF);
        url = `https://${s3Bucket}.s3.${region}.amazonaws.com/${s3PathPDF}`;
        break;
      case "TEX":
        const filenameTEX = `${eachRequestData.fileName}.tex`;
        const localPathTEX = `/tmp/${filenameTEX}`;
        await generateFile(
          [`--template=./template.latex`],
          localPathTEX,
          markdown
        );

        const s3PathTEX = `${eachRequestData.userId}/${filenameTEX}`;

        await saveFileToS3(localPathTEX, s3PathTEX);
        break;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      url,
    }),
  };
};
