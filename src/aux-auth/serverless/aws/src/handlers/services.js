// Create clients and set shared const values outside of the handler.
const { Magic } = require('@magic-sdk/admin');
const { formatResponse } = require('../utils');

// Get the DynamoDB table name from environment variables
const USER_SERVICES_TABLE = process.env.USER_SERVICES_TABLE;
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
export async function getServiceForIssuer(event) {
    if (event.httpMethod !== 'GET') {
        throw new Error(
            `getServiceForIssuer only accept GET method, you tried: ${event.httpMethod}`
        );
    }
    // All log statements are written to CloudWatch
    console.info('received:', event);

    const issuer = event.pathParameters.token;
    const service = event.pathParameters.service;

    // get all items from the table (only first 1MB data, you can use `LastEvaluatedKey` to get the rest of data)
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#scan-property
    // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html
    const data = await docClient
        .get({
            TableName: USER_SERVICES_TABLE,
            Key: { userId: issuer, service: service },
        })
        .promise();
    const item = data.Item;

    let response;
    if (!item) {
        response = {
            statusCode: 404,
        };
    } else {
        response = {
            statusCode: 200,
            body: JSON.stringify({
                userId: item.userId,
                service: item.service,
            }),
        };
    }

    // All log statements are written to CloudWatch
    console.info(
        `response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`
    );
    return formatResponse(response);
}

/**
 * A simple example includes a HTTP get method to get all items from a DynamoDB table.
 */
export async function putService(event) {
    if (event.httpMethod !== 'PUT') {
        throw new Error(
            `putService only accept PUT method, you tried: ${event.httpMethod}`
        );
    }
    // All log statements are written to CloudWatch
    console.info('received:', event);

    const token = event.pathParameters.token;
    const issuer = magic.token.getIssuer(token);
    const { service, token: serviceToken } = JSON.parse(event.body);

    magic.token.validate(serviceToken, service);

    await docClient
        .put({
            TableName: USER_SERVICES_TABLE,
            Item: {
                userId: issuer,
                service: service,
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
    return formatResponse(response);
}

export async function handleService(event) {
    if (event.httpMethod === 'PUT') {
        return await putService(event);
    } else {
        return await getServiceForIssuer(event);
    }
}
