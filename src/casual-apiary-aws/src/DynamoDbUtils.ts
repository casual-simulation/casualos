import { DocumentClient, WriteRequest } from 'aws-sdk/clients/dynamodb';
import { delay } from './Utils';

const MAX_BATCH_ITEM_WRITE_COUNT = 25;
const MAX_RETRY_COUNT = 5;
const DEFAULT_BACKOFF_MILLISECONDS = 0.5;

/**
 * Processes the given batch of write requests with the given DynamoDB client and TableName.
 * @param requests
 * @param tryCount
 */
export async function processBatch(
    client: DocumentClient,
    tableName: string,
    requests: WriteRequest[],
    tryCount: number = 0
) {
    const unprocessedRequests: WriteRequest[] = [];
    for (let i = 0; i < requests.length; i += MAX_BATCH_ITEM_WRITE_COUNT) {
        const slice = requests.slice(i, i + MAX_BATCH_ITEM_WRITE_COUNT);
        const data = await client
            .batchWrite({
                RequestItems: {
                    [tableName]: slice,
                },
            })
            .promise();

        if (data.UnprocessedItems?.[tableName]?.length > 0) {
            console.log(
                '[DynamoDbUtils] Some items were not processed: ' +
                    data.UnprocessedItems?.[tableName]?.length +
                    '/' +
                    slice.length
            );
            unprocessedRequests.push(...data.UnprocessedItems[tableName]);
        }
    }

    if (unprocessedRequests.length > 0) {
        if (tryCount < MAX_RETRY_COUNT) {
            await delay(DEFAULT_BACKOFF_MILLISECONDS * Math.pow(2, tryCount));
            return processBatch(
                client,
                tableName,
                unprocessedRequests,
                tryCount + 1
            );
        }
    }
}
