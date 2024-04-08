import { APIGatewayEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { spawn } from 'child_process';
import * as z from 'zod';
import * as fs from 'fs';
import { S3 } from 'aws-sdk';

export const SetSchema = z.object({
  functionName: z.string(),
  dockerImageUri: z.string(),
  apiKey: z.string(),
});

export const handler = async function (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  console.log("I am starting, your handler")
  const message = JSON.parse(JSON.stringify(event));
  console.log('Processing this event:', message);

  //const s3Client = new S3();
  
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
    /*
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
    */

    // ************ check ***************
    const ls = spawn('ls', ['-lh', 'usr']);

    ls.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
    
    ls.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });
    
    ls.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
    });

    // **********************************

    const inputString = '# Heading\n\nThis is some **bold** text.';
    const outputFilePath = 'output.pdf';


    // Define Pandoc command and arguments
    //const pandocCommand = 'pandoc';
    if(fs.existsSync('/usr/bin/pandoc')){
      console.log('Path exists')
    }
    else{
      // Below code to create the folder, if its not there
      console.log('Path does not exists')
    }
    const pandocCommand = '/usr/bin/pandoc';
    const pandocArgs = [
      '--from=markdown',  // Specify input format as Markdown
      '-o',
      outputFilePath,
      '-'];  // Use '-' to indicate reading from stdin
    console.log('step 1')
    // Execute Pandoc command
    const pandocProcess = spawn(pandocCommand, pandocArgs);
    console.log('step 2')
    // Write input string to stdin
    pandocProcess.stdin.write(inputString);
    pandocProcess.stdin.end();  // Close stdin to indicate end of input
    console.log('step 3')

    // Handle stdout, stderr, and exit events
    pandocProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
    console.log('step 4')
    pandocProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });
    console.log('step 5')
    pandocProcess.on('close', (code) => {
        if (code === 0) {
            console.log('Pandoc process exited successfully');
        } else {
            console.error(`Pandoc process exited with code ${code}`);
        }
    });
/*
    
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
*/
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