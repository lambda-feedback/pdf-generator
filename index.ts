
import { APIGatewayEvent, Context, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async function (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  console.error('Lambda function handler called')
  console.log('Processing event: %s', JSON.stringify(event, null, 2));
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'what a lovely day there',
    })
  }
};