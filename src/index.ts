
import { APIGatewayEvent, Context } from 'aws-lambda';

console.log('Hello from PDF Generator. This is a test')

export const handler = async function (event: APIGatewayEvent, context: Context) {
  console.error('Lambda function handler called')
  const queries = 
  console.log('Processing event: %s', JSON.stringify(event, null, 2));
  return {
    statusCode: 200,
    body: 'Hello from pdf lambda!'
  }
};