
import { APIGatewayEvent, Context } from 'aws-lambda';

export const handler = async function (event: APIGatewayEvent, context: Context) {
  console.error('Lambda function handler called')
  console.log('Processing event: %s', JSON.stringify(event, null, 2));
  return {
    statusCode: 200,
    body: 'Hello from pdf lambda!'
  }
};