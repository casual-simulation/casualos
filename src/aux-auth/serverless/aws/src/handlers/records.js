// Create clients and set shared const values outside of the handler.
const { Magic } = require('@magic-sdk/admin');
const { formatResponse, validateOrigin, findHeader } = require('../utils');
const { ServerlessRecordsStore } = require('../ServerlessRecordsStore');
const { ServerlessRecordsManager } = require('../ServerlessRecordsManager');
const { MagicAuthProvider } = require('../MagicAuthProvider');

// Get the DynamoDB table name from environment variables
const RECORDS_TABLE = process.env.RECORDS_TABLE;
const MAGIC_SECRET_KEY = process.env.MAGIC_SECRET_KEY;
const REDIS_PORT = process.env.REDIS_PORT;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_USE_TLS = process.env.REDIS_USE_TLS === 'true';
const REDIS_RECORDS_NAMESPACE = process.env.REDIS_RECORDS_NAMESPACE;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Create a DocumentClient that represents the query to add an item
const dynamodb = require('aws-sdk/clients/dynamodb');
const docClient = new dynamodb.DocumentClient({
    endpoint: DYNAMODB_ENDPOINT,
});

const redis = require('redis');
const redisClient = redis.createClient({
    port: REDIS_PORT,
    host: REDIS_HOST,
    tls: REDIS_USE_TLS,
    password: REDIS_PASSWORD,
});

const store = new ServerlessRecordsStore(
    docClient,
    RECORDS_TABLE,
    redisClient,
    REDIS_RECORDS_NAMESPACE
);
const auth = new MagicAuthProvider(MAGIC_SECRET_KEY);

const manager = new ServerlessRecordsManager(auth, store);

const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3002',
    'http://player.localhost:3000',
    'https://casualos.com',
    'https://casualos.me',
    'https://ab1.link',
    'https://publicos.com',
]);

function returnResult(event, result) {
    if (result.message) {
        return formatResponse(
            event,
            {
                statusCode: result.status,
                body: JSON.stringify({
                    message: result.message,
                }),
            },
            allowedOrigins
        );
    }
    return formatResponse(
        event,
        {
            statusCode: result.status,
            body: JSON.stringify(result.data),
        },
        allowedOrigins
    );
}

async function postOrDeleteRecord(event) {
    if (event.httpMethod !== 'POST') {
        throw new Error(
            `postOrDeleteRecord only accept POST method, you tried: ${event.httpMethod}`
        );
    }

    if (event.path.endsWith('/delete')) {
        return deleteRecord(event);
    } else {
        return postRecord(event);
    }
}

async function deleteRecord(event) {
    if (!validateOrigin(event, allowedOrigins)) {
        throw new Error('Invalid origin');
    }

    const data = JSON.parse(event.body);
    const result = await manager.deleteRecord(data);
    return returnResult(event, result);
}

async function postRecord(event) {
    if (!validateOrigin(event, allowedOrigins)) {
        throw new Error('Invalid origin');
    }

    const data = JSON.parse(event.body);
    const result = await manager.publishRecord(data);
    return returnResult(event, result);
}

async function getRecords(event) {
    if (event.httpMethod !== 'GET') {
        throw new Error(
            `getRecords only accept GET method, you tried: ${event.httpMethod}`
        );
    }

    if (!validateOrigin(event, allowedOrigins)) {
        throw new Error('Invalid origin');
    }

    if (!event.queryStringParameters.authID) {
        return formatResponse(
            event,
            {
                statusCode: 400,
            },
            allowedOrigins
        );
    }

    const authorization = findHeader(event, 'authorization');

    let token;

    if (authorization && authorization.startsWith('Bearer ')) {
        token = authorization.slice('Bearer '.length);
    }

    let params = {};

    getQueryParam('authID', 'issuer');
    getQueryParam('address');
    getQueryParam('prefix');
    getQueryParam('cursor');
    getQueryParam('space');

    if (token) {
        params.token = token;
    }

    const result = await manager.getRecords(params);

    return returnResult(event, result);

    function getQueryParam(param, name = param) {
        if (event.queryStringParameters[param]) {
            params[name] = decodeURIComponent(
                event.queryStringParameters[param]
            );
        }
    }
}

export async function handleRecords(event) {
    if (event.httpMethod === 'POST') {
        return await postOrDeleteRecord(event);
    } else {
        return await getRecords(event);
    }
}
