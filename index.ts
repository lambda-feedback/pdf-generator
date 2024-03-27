
import { APIGatewayEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import * as z from 'zod';

export const SetSchema = z.object({
  functionName: z.string(),
  dockerImageUri: z.string(),
  apiKey: z.string(),
});

export const handler = async function (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  console.error('Lambda function handler called')
  const message = JSON.parse(JSON.stringify(event));
  event.queryStringParameters
  console.log('Processing this event:', message);
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'what a lovely day there, is not it?',
    })
  }
};