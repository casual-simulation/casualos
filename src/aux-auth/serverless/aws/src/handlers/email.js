const { formatResponse, validateOrigin } = require('../utils');

const EMAIL_TABLE = process.env.EMAIL_TABLE;
// Create a DocumentClient that represents the query to add an item
const dynamodb = require('aws-sdk/clients/dynamodb');
const docClient = new dynamodb.DocumentClient({
    endpoint: DYNAMODB_ENDPOINT,
});

export async function handler(event) {
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
            result.Items.map((item) => ({
                type: item.type,
                pattern: item.pattern,
            }))
        ),
    });
}
