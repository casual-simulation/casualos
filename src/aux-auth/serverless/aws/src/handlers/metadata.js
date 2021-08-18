// Create clients and set shared const values outside of the handler.
const { Magic } = require('@magic-sdk/admin');
const { formatResponse } = require('../utils');

// Get the DynamoDB table name from environment variables
const USERS_TABLE = process.env.USERS_TABLE;
const MAGIC_SECRET_KEY = process.env.MAGIC_SECRET_KEY;

// Create a DocumentClient that represents the query to add an item
const dynamodb = require('aws-sdk/clients/dynamodb');
const docClient = new dynamodb.DocumentClient({
    endpoint: DYNAMODB_ENDPOINT,
});
const magic = new Magic(MAGIC_SECRET_KEY);

/**
 * A simple example includes a HTTP get method to get all items from a DynamoDB table.
 */
export async function getIssuerMetadata(event) {
    if (event.httpMethod !== 'GET') {
        throw new Error(
            `getIssuerMetadata only accept GET method, you tried: ${event.httpMethod}`
        );
    }
    // All log statements are written to CloudWatch
    console.info('received:', event);

    const issuer = event.pathParameters.token;

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
export async function putIssuerMetadata(event) {
    if (event.httpMethod !== 'PUT') {
        throw new Error(
            `putIssuerMetadata only accept PUT method, you tried: ${event.httpMethod}`
        );
    }
    // All log statements are written to CloudWatch
    console.info('received:', event);

    const token = event.pathParameters.token;
    console.log('Token', token);
    const issuer = magic.token.getIssuer(token);
    const data = JSON.parse(event.body);

    await docClient
        .put({
            TableName: USERS_TABLE,
            Item: {
                id: issuer,
                name: data.name,
                avatarUrl: data.avatarUrl,
                avatarPortraitUrl: data.avatarPortraitUrl,
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

export async function handleMetadata(event) {
    if (event.httpMethod === 'PUT') {
        return await putIssuerMetadata(event);
    } else {
        return await getIssuerMetadata(event);
    }
}
