// Create clients and set shared const values outside of the handler.

import { APIGatewayProxyEvent } from 'aws-lambda';
import {
    formatResponse,
    validateOrigin,
    getAuthController,
    formatStatusCode,
} from '../utils';

// const { Magic } = require('@magic-sdk/admin');

declare const DYNAMODB_ENDPOINT: string;

// Get the DynamoDB table name from environment variables
const USERS_TABLE = process.env.USERS_TABLE;

// Create a DocumentClient that represents the query to add an item
const dynamodb = require('aws-sdk/clients/dynamodb');
const docClient = new dynamodb.DocumentClient({
    endpoint: DYNAMODB_ENDPOINT,
});
const authController = getAuthController(docClient);

/**
 * A simple example includes a HTTP get method to get all items from a DynamoDB table.
 */
export async function getIssuerMetadata(event: APIGatewayProxyEvent) {
    if (event.httpMethod !== 'GET') {
        throw new Error(
            `getIssuerMetadata only accept GET method, you tried: ${event.httpMethod}`
        );
    }
    // All log statements are written to CloudWatch
    console.info('received:', event);

    const issuer = decodeURIComponent(event.pathParameters.token);

    // get all items from the table (only first 1MB data, you can use `LastEvaluatedKey` to get the rest of data)
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#scan-property
    // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html
    const data = await docClient
        .get({
            TableName: USERS_TABLE,
            Key: { id: issuer },
        })
        .promise();
    const item = data.Item;

    if (!item) {
        return formatResponse(event, {
            statusCode: 404,
        });
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify({
            name: item.name,
            avatarUrl: item.avatarUrl,
            avatarPortraitUrl: item.avatarPortraitUrl,
            email: item.email,
            phoneNumber: item.phoneNumber,
        }),
    };

    // All log statements are written to CloudWatch
    console.info(
        `response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`
    );
    return formatResponse(event, response);
}

/**
 * A simple example includes a HTTP get method to get all items from a DynamoDB table.
 */
export async function putIssuerMetadata(event: APIGatewayProxyEvent) {
    if (event.httpMethod !== 'PUT') {
        throw new Error(
            `putIssuerMetadata only accept PUT method, you tried: ${event.httpMethod}`
        );
    }

    if (!validateOrigin(event)) {
        throw new Error('Invalid origin');
    }

    // All log statements are written to CloudWatch
    console.info('received:', event);

    const token = decodeURIComponent(event.pathParameters.token);
    console.log('Token', token);

    const validationResult = await authController.validateSessionKey(token);
    if (validationResult.success === false) {
        return formatResponse(event, {
            statusCode: formatStatusCode(validationResult),
            body: JSON.stringify(validationResult),
        });
    }

    const issuer = validationResult.userId;
    const data = JSON.parse(event.body);

    await docClient
        .put({
            TableName: USERS_TABLE,
            Item: {
                id: issuer,
                name: data.name,
                avatarUrl: data.avatarUrl,
                avatarPortraitUrl: data.avatarPortraitUrl,
                email: data.email,
                phoneNumber: data.phoneNumber,
            },
        })
        .promise();

    const response = {
        statusCode: 200,
        body: JSON.stringify({}),
    };

    // All log statements are written to CloudWatch
    console.info(
        `response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`
    );
    return formatResponse(event, response);
}

export async function handleMetadata(event: APIGatewayProxyEvent) {
    if (event.httpMethod === 'PUT') {
        return await putIssuerMetadata(event);
    } else {
        return await getIssuerMetadata(event);
    }
}
