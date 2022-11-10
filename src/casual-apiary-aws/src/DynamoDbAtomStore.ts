import { Atom } from '@casual-simulation/causal-trees';
import { ApiaryAtomStore } from './ApiaryAtomStore';
import AWS from 'aws-sdk';
import { getDocumentClient } from './Utils';
import {
    PutItemInputAttributeMap,
    PutRequest,
    WriteRequest,
} from 'aws-sdk/clients/dynamodb';
import { processBatch } from './DynamoDbUtils';
import { sortBy } from 'lodash';

/**
 * Defines a class that specifies a DynamoDB implementation of an ApiaryAtomStore.
 */
export class DynamoDbAtomStore implements ApiaryAtomStore {
    private _tableName: string;
    private _client: AWS.DynamoDB.DocumentClient;

    constructor(tableName: string, client?: AWS.DynamoDB.DocumentClient) {
        this._tableName = tableName;
        this._client = client || getDocumentClient();
    }

    async saveAtoms(namespace: string, atoms: Atom<any>[]): Promise<void> {
        const requests: WriteRequest[] = atoms.map((a) => ({
            PutRequest: {
                Item: formatAtom(namespace, a),
            },
        }));

        await processBatch(this._client, this._tableName, requests);
    }

    async loadAtoms(namespace: string): Promise<Atom<any>[]> {
        let result = await this._client
            .query({
                TableName: this._tableName,
                ProjectionExpression: 'atomJson',
                KeyConditionExpression: 'namespace = :namespace',
                ExpressionAttributeValues: {
                    ':namespace': namespace,
                },
            })
            .promise();

        let atoms = [] as Atom<any>[];
        while (result?.$response.data) {
            for (let item of result.$response.data.Items) {
                const atom = JSON.parse(item.atomJson);
                atoms.push(atom);
            }

            if (result.$response.hasNextPage()) {
                const request = result.$response.nextPage();
                if (request) {
                    result = await request.promise();
                    continue;
                }
            }
            result = null;
        }

        return sortBy(atoms, (a) => a.id.timestamp);
    }

    async countAtoms(namespace: string): Promise<number> {
        let result = await this._client
            .query({
                TableName: this._tableName,
                Select: 'COUNT',
                KeyConditionExpression: 'namespace = :namespace',
                ExpressionAttributeValues: {
                    ':namespace': namespace,
                },
            })
            .promise();

        return result.Count;
    }

    async deleteAtoms(namespace: string, atomHashes: string[]): Promise<void> {
        const requests: WriteRequest[] = atomHashes.map((hash) => ({
            DeleteRequest: {
                Key: {
                    namespace: namespace as any,
                    atomHash: hash as any,
                },
            },
        }));

        await processBatch(this._client, this._tableName, requests);
    }

    async clearNamespace(namespace: string): Promise<void> {
        const atoms = await this.loadAtoms(namespace);
        await this.deleteAtoms(
            namespace,
            atoms.map((a) => a.hash)
        );
    }
}

interface DynamoAtom {
    namespace: string;
    atomHash: string;
    atomJson: string;
}

function formatAtom(
    namespace: string,
    atom: Atom<any>
): PutItemInputAttributeMap {
    return {
        namespace: namespace as any,
        atomHash: atom.hash as any,
        atomJson: JSON.stringify(atom) as any,
    };
}
