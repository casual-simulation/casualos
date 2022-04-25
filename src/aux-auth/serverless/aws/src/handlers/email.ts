import type {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
} from 'aws-lambda';
const { formatResponse, validateOrigin } = require('../utils');

declare let DYNAMODB_ENDPOINT: string;

const EMAIL_TABLE = process.env.EMAIL_TABLE;
const SMS_TABLE = process.env.SMS_TABLE;
// Create a DocumentClient that represents the query to add an item
const dynamodb = require('aws-sdk/clients/dynamodb');
const docClient = new dynamodb.DocumentClient({
    endpoint: DYNAMODB_ENDPOINT,
});

export async function handleEmail(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const result = await docClient
        .scan({
            TableName: EMAIL_TABLE,
        })
        .promise();

    if (!result.Items) {
        return formatResponse({
            statusCode: 404,
            body: 'Could not find email rules.',
        });
    }

    return formatResponse(event, {
        statusCode: 200,
        body: JSON.stringify(
            result.Items.map((item: any) => ({
                type: item.type,
                pattern: item.pattern,
            }))
        ),
    });
}

export async function handleSms(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const result = await docClient
        .scan({
            TableName: SMS_TABLE,
        })
        .promise();

    if (!result.Items) {
        return formatResponse({
            statusCode: 404,
            body: 'Could not find SMS rules.',
        });
    }

    return formatResponse(event, {
        statusCode: 200,
        body: JSON.stringify(
            result.Items.map((item: any) => ({
                type: item.type,
                pattern: item.pattern,
            }))
        ),
    });
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    if (event.path === '/api/emailRules') {
        return handleEmail(event);
    } else if(event.path === '/api/smsRules') {
        return handleSms(event);
    }

    return formatResponse(event, {
        statusCode: 404
    });
}