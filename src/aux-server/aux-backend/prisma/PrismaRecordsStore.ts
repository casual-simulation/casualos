import { hasValue } from '@casual-simulation/aux-common';
import {
    Record,
    RecordsStore,
    RecordKey,
    cleanupObject,
    ListedRecord,
    Studio,
    StudioAssignment,
    ListedStudioAssignment,
    ListedUserAssignment,
    StoreListedStudio,
    ListStudioAssignmentFilters,
    StudioAssignmentRole,
    CountRecordsFilter,
} from '@casual-simulation/aux-records';
import { PrismaClient, Prisma } from '@prisma/client';

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
                studioId: record.studioId,
                secretHashes: record.secretHashes,
                secretSalt: record.secretSalt,
            },
            update: {
                name: record.name,
                ownerId: record.ownerId,
                studioId: record.studioId,
                secretHashes: record.secretHashes,
                secretSalt: record.secretSalt,
            },
        });
    }

    async addRecord(record: Record): Promise<void> {
        await this._client.record.upsert({
            where: {
                name: record.name,
            },
            create: {
                name: record.name,
                ownerId: record.ownerId,
                studioId: record.studioId,
                secretHashes: record.secretHashes,
                secretSalt: record.secretSalt,
            },
            update: {},
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
                studioId: true,
            },
        });
    }

    listRecordsByStudioId(studioId: string): Promise<ListedRecord[]> {
        return this._client.record.findMany({
            where: {
                studioId: studioId,
            },
            select: {
                name: true,
                ownerId: true,
                studioId: true,
            },
        });
    }

    listRecordsByStudioIdAndUserId(
        studioId: string,
        userId: string
    ): Promise<ListedRecord[]> {
        return this._client.record.findMany({
            where: {
                studioId: studioId,
                studio: {
                    assignments: {
                        some: {
                            userId: userId,
                        },
                    },
                },
            },
            select: {
                name: true,
                ownerId: true,
                studioId: true,
            },
        });
    }

    async addStudio(studio: Studio): Promise<void> {
        await this._client.studio.create({
            data: {
                id: studio.id,
                displayName: studio.displayName,
                stripeCustomerId: studio.stripeCustomerId,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
            },
        });
    }

    async createStudioForUser(
        studio: Studio,
        adminId: string
    ): Promise<{ studio: Studio; assignment: StudioAssignment }> {
        const result = await this._client.studio.create({
            data: {
                id: studio.id,
                displayName: studio.displayName,
                stripeCustomerId: studio.stripeCustomerId,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
                assignments: {
                    create: {
                        userId: adminId,
                        isPrimaryContact: true,
                        role: 'admin',
                    },
                },
            },
        });

        return {
            studio: result,
            assignment: {
                studioId: result.id,
                userId: adminId,
                isPrimaryContact: true,
                role: 'admin',
            },
        };
    }

    async getStudioById(id: string): Promise<Studio> {
        return await this._client.studio.findUnique({
            where: {
                id: id,
            },
        });
    }

    async getStudioByStripeCustomerId(customerId: string): Promise<Studio> {
        return await this._client.studio.findUnique({
            where: {
                stripeCustomerId: customerId,
            },
        });
    }

    async updateStudio(studio: Studio): Promise<void> {
        await this._client.studio.update({
            where: {
                id: studio.id,
            },
            data: {
                displayName: studio.displayName,
                stripeCustomerId: studio.stripeCustomerId,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
            },
        });
    }

    async listStudiosForUser(userId: string): Promise<StoreListedStudio[]> {
        const assignments = await this._client.studioAssignment.findMany({
            where: {
                userId: userId,
            },
            select: {
                studioId: true,
                userId: true,
                role: true,
                isPrimaryContact: true,
                studio: {
                    select: {
                        displayName: true,
                        subscriptionId: true,
                        subscriptionStatus: true,
                    },
                },
            },
        });

        return assignments.map((a) => ({
            studioId: a.studioId,
            userId: a.userId,
            role: a.role as StudioAssignmentRole,
            isPrimaryContact: a.isPrimaryContact,
            displayName: a.studio.displayName,
            subscriptionId: a.studio.subscriptionId,
            subscriptionStatus: a.studio.subscriptionStatus,
        }));
    }

    async addStudioAssignment(assignment: StudioAssignment): Promise<void> {
        await this._client.studioAssignment.create({
            data: {
                studioId: assignment.studioId,
                userId: assignment.userId,
                isPrimaryContact: assignment.isPrimaryContact,
                role: assignment.role,
            },
        });
    }

    async updateStudioAssignment(assignment: StudioAssignment): Promise<void> {
        await this._client.studioAssignment.update({
            where: {
                studioId_userId: {
                    studioId: assignment.studioId,
                    userId: assignment.userId,
                },
            },
            data: {
                isPrimaryContact: assignment.isPrimaryContact,
                role: assignment.role,
            },
        });
    }

    async removeStudioAssignment(
        studioId: string,
        userId: string
    ): Promise<void> {
        await this._client.studioAssignment.delete({
            where: {
                studioId_userId: {
                    studioId: studioId,
                    userId: userId,
                },
            },
        });
    }

    async listStudioAssignments(
        studioId: string,
        filters?: ListStudioAssignmentFilters
    ): Promise<ListedStudioAssignment[]> {
        let filter: Prisma.StudioAssignmentWhereInput = {
            studioId: studioId,
        };

        if (hasValue(filters?.userId)) {
            filter.userId = filters.userId;
        }

        if (hasValue(filters?.role)) {
            filter.role = filters.role;
        }

        if (hasValue(filters?.isPrimaryContact)) {
            filter.isPrimaryContact = filters.isPrimaryContact;
        }

        const assignments = await this._client.studioAssignment.findMany({
            where: filter,
            select: {
                studioId: true,
                userId: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumber: true,
                    },
                },
                role: true,
                isPrimaryContact: true,
            },
            orderBy: [
                {
                    user: {
                        email: 'asc',
                    },
                },
                {
                    user: {
                        phoneNumber: 'asc',
                    },
                },
            ],
        });

        return assignments.map((a) => {
            const assignment: ListedStudioAssignment = {
                studioId: a.studioId,
                userId: a.userId,
                role: a.role as StudioAssignmentRole,
                isPrimaryContact: a.isPrimaryContact,
                user: {
                    id: a.user.id,
                    name: a.user.name,
                    email: a.user.email,
                    phoneNumber: a.user.phoneNumber,
                },
            };

            return assignment;
        });
    }

    async listUserAssignments(userId: string): Promise<ListedUserAssignment[]> {
        const assignments = await this._client.studioAssignment.findMany({
            where: {
                userId: userId,
            },
            select: {
                studioId: true,
                userId: true,
                isPrimaryContact: true,
                role: true,
                studio: {
                    select: {
                        displayName: true,
                    },
                },
            },
        });

        return assignments.map((a) => {
            const assignment: ListedUserAssignment = {
                studioId: a.studioId,
                userId: a.userId,
                role: a.role as StudioAssignmentRole,
                isPrimaryContact: a.isPrimaryContact,
                displayName: a.studio.displayName,
            };

            return assignment;
        });
    }

    async countRecords(filter: CountRecordsFilter): Promise<number> {
        let where: Prisma.RecordWhereInput = {};
        if ('ownerId' in filter) {
            where.ownerId = filter.ownerId;
        }
        if ('studioId' in filter) {
            where.studioId = filter.studioId;
        }
        return await this._client.record.count({
            where,
        });
    }
}
