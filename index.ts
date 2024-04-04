import { APIGatewayEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { PdcTs } from 'pdc-ts'
import * as z from 'zod';
import * as fs from 'fs';
import { S3 } from 'aws-sdk';

export const SetSchema = z.object({
  functionName: z.string(),
  dockerImageUri: z.string(),
  apiKey: z.string(),
});

export const handler = async function (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  
  const message = JSON.parse(JSON.stringify(event));
  console.log('Processing this event:', message);

  const s3Client = new S3();

  const pdcTs = new PdcTs();
  
  let markdown = 'Hello from *PDF*';
  //const humanSetNumber = set.number + 1;
  const humanSetNumber = 1;

 /*
  const filename = `${
    set.ModuleInstance.Module.slug
  }_S${humanSetNumber}_${new Date()
    .toISOString()
    .replace(/[-:T.]/g, '')
    .slice(0, 14)}.pdf`; // Note: set name not a slug so not used.
*/
    const filename = `test_S${humanSetNumber}_${new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 14)}.pdf`; // Note: set name not a slug so not used.

  //const localPath = `src/pdf/${filename}`;
  const localPath = `./${filename}`;
  //const s3Path = `${user.id}/${filename}`;
  const s3Path = `test/${filename}`;
  let url: string | undefined;

  try {
    console.log('step 0')
    const pdfString = await pdcTs.Execute({
      //from: 'markdown-implicit_figures', // pandoc source format (disabling the implicit_figures extension to remove all image captions)
      from: 'markdown',
      to: 'latex', // pandoc output format
      pandocArgs: [
        '--pdf-engine=xelatex',
        `--template=./template.latex`,
      ],
 //     spawnOpts: { argv0: '+RTS -M512M -RTS' },
      outputToFile: false, // Controls whether the output will be returned as a string or written to a file
      sourceText: markdown, // Use this if your input is a string. If you set this, the file input will be ignored
 //     destFilePath: localPath,
    });
    console.log('step 1')
    const fileStream = fs.createReadStream(localPath);
    console.log('step 2')
      await s3Client.upload({
       // Bucket: this.configurationService.PUBLIC_S3_BUCKET,
        Bucket: 'lambda-feedback-staging-frontend-client-bucket',
        Key: s3Path,
        Body: fileStream,
      }).promise();
      
      console.log('step 3')
      //url = `https://${this.configurationService.PUBLIC_S3_BUCKET}.s3.${this.configurationService.PUBLIC_S3_BUCKET_REGION}.amazonaws.com/${s3Path}`;
      url = `https://lambda-feedback-staging-frontend-client-bucket.s3.eu-west-2.amazonaws.com/${s3Path}`;
      
      console.log('step 4')

  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error(e.message);
    } else {
      console.error('something went wrong generating the pdf');
      console.error(e);
    }
    /*
    const TeXoutput = await pdcTs.Execute({
      from: 'markdown-implicit_figures', // pandoc source format (disabling the implicit_figures extension to remove all image captions)
      to: 'latex', // pandoc output format
      pandocArgs: [
        '--pdf-engine=xelatex',
        `--template=./template.latex`,
      ],
      outputToFile: false, // Controls whether the output will be returned as a string or written to a file
      sourceText: markdown, // Use this if your input is a string. If you set this, the file input will be ignored
      destFilePath: localPath,
    });
    */
    // Find the offending text from the error message:
    //e = errorRefiner(String(e), TeXoutput, false);
    throw e;
  } finally {
    // cleanup
    //fs.rm(localPath, noop);
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'what a lovely day there, is not it?',
    })
  }
};