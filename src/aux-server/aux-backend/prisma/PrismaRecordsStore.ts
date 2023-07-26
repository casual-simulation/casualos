import {
    Record,
    RecordsStore,
    RecordKey,
    cleanupObject,
    ListedRecord,
} from '@casual-simulation/aux-records';
import { PrismaClient } from '@prisma/client';

export class PrismaRecordsStore implements RecordsStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    async updateRecord(record: Record): Promise<void> {
        await this._client.record.upsert({
            where: {
                name: record.name,
            },
            create: {
                name: record.name,
                ownerId: record.ownerId,
                secretHashes: record.secretHashes,
                secretSalt: record.secretSalt,
            },
            update: {
                name: record.name,
                ownerId: record.ownerId,
                secretHashes: record.secretHashes,
                secretSalt: record.secretSalt,
            },
        });
    }

    async addRecord(record: Record): Promise<void> {
        await this._client.record.create({
            data: {
                name: record.name,
                ownerId: record.ownerId,
                secretHashes: record.secretHashes,
                secretSalt: record.secretSalt,
            },
        });
    }

    async getRecordByName(name: string): Promise<Record> {
        const record = await this._client.record.findUnique({
            where: {
                name: name,
            },
        });
        return record as any;
    }

    /**
     * Adds the given record key to the store.
     * @param key The key to add.
     */
    async addRecordKey(key: RecordKey): Promise<void> {
        await this._client.recordKey.create({
            data: {
                recordName: key.recordName,
                secretHash: key.secretHash,
                creatorId: key.creatorId,
                policy: key.policy as any,
            },
        });
    }

    /**
     * Gets the record key for the given record name that has the given hash.
     * @param recordName The name of the record.
     * @param hash The scrypt hash of the key that should be retrieved.
     */
    async getRecordKeyByRecordAndHash(
        recordName: string,
        hash: string
    ): Promise<RecordKey> {
        const recordKey = await this._client.recordKey.findUnique({
            where: {
                recordName_secretHash: {
                    recordName,
                    secretHash: hash,
                },
            },
        });

        return recordKey as any;
    }

    listRecordsByOwnerId(ownerId: string): Promise<ListedRecord[]> {
        return this._client.record.findMany({
            where: {
                ownerId: ownerId,
            },
            select: {
                name: true,
                ownerId: true,
            },
        });
    }
}
