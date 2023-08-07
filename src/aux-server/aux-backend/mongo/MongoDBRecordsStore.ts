import { hasValue } from '@casual-simulation/aux-common';
import {
    Record,
    RecordsStore,
    RecordKey,
    ListedRecord,
    AuthStore,
    Studio,
    StudioAssignment,
    ListedStudioAssignment,
    ListedUserAssignment,
    ListedStudio,
    ListStudioAssignmentFilters,
} from '@casual-simulation/aux-records';
import { Collection, FilterQuery } from 'mongodb';

export class MongoDBRecordsStore implements RecordsStore {
    private _collection: Collection<Record>;
    private _keyCollection: Collection<RecordKey>;
    private _studios: Collection<MongoDBStudio>;
    private _auth: AuthStore;

    constructor(
        collection: Collection<Record>,
        keys: Collection<RecordKey>,
        studios: Collection<MongoDBStudio>,
        auth: AuthStore
    ) {
        this._collection = collection;
        this._keyCollection = keys;
        this._studios = studios;
        this._auth = auth;
    }

    async updateRecord(record: Record): Promise<void> {
        await this._collection.updateOne(
            {
                name: record.name,
            },
            {
                $set: record,
            },
            { upsert: true }
        );
    }

    async addRecord(record: Record): Promise<void> {
        await this._collection.insertOne(record);
    }

    async getRecordByName(name: string): Promise<Record> {
        const record = await this._collection.findOne({
            name: name,
        });

        return record;
    }

    /**
     * Adds the given record key to the store.
     * @param key The key to add.
     */
    async addRecordKey(key: RecordKey): Promise<void> {
        await this._keyCollection.insertOne(key);
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
        const key = await this._keyCollection.findOne({
            recordName: recordName,
            secretHash: hash,
        });

        return key;
    }

    listRecordsByOwnerId(ownerId: string): Promise<ListedRecord[]> {
        return this._collection.find({ ownerId: ownerId }).toArray();
    }

    listRecordsByStudioId(studioId: string): Promise<ListedRecord[]> {
        return this._collection.find({ studioId: studioId }).toArray();
    }

    async listRecordsByStudioIdAndUserId(
        studioId: string,
        userId: string
    ): Promise<ListedRecord[]> {
        const studio = await this._studios.findOne({
            studioId: studioId,
        });

        if (!studio) {
            return [];
        }

        const isAssigned = studio.assignments.some((a) => a.userId === userId);

        if (!isAssigned) {
            return [];
        }

        return this.listRecordsByStudioId(studioId);
    }

    async addStudio(studio: Studio): Promise<void> {
        this._studios.insertOne({
            ...studio,
            _id: studio.id,
            assignments: [],
        });
    }

    async createStudioForUser(
        studio: Studio,
        adminId: string
    ): Promise<{ studio: Studio; assignment: StudioAssignment }> {
        await this.addStudio(studio);
        const assignment: StudioAssignment = {
            studioId: studio.id,
            userId: adminId,
            isPrimaryContact: true,
            role: 'admin',
        };
        await this.addStudioAssignment(assignment);

        return {
            studio,
            assignment,
        };
    }

    async updateStudio(studio: Studio): Promise<void> {
        await this._studios.updateOne(
            {
                _id: studio.id,
            },
            {
                $set: {
                    displayName: studio.displayName,
                    stripeCustomerId: studio.stripeCustomerId,
                    subscriptionId: studio.subscriptionId,
                    subscriptionStatus: studio.subscriptionStatus,
                },
            },
            { upsert: true }
        );
    }

    async getStudioById(id: string): Promise<Studio> {
        const studio = await this._studios.findOne({
            _id: id,
        });

        if (!studio) {
            return null;
        }

        return {
            id: studio._id,
            displayName: studio.displayName,
            stripeCustomerId: studio.stripeCustomerId,
            subscriptionId: studio.subscriptionId,
            subscriptionStatus: studio.subscriptionStatus,
        };
    }

    async getStudioByStripeCustomerId(customerId: string): Promise<Studio> {
        const studio = await this._studios.findOne({
            stripeCustomerId: customerId,
        });

        if (!studio) {
            return null;
        }

        return {
            id: studio._id,
            displayName: studio.displayName,
            stripeCustomerId: studio.stripeCustomerId,
            subscriptionId: studio.subscriptionId,
            subscriptionStatus: studio.subscriptionStatus,
        };
    }

    async listStudiosForUser(userId: string): Promise<ListedStudio[]> {
        const studios = await this._studios
            .find({
                assignments: {
                    $elemMatch: {
                        userId: userId,
                    },
                },
            })
            .toArray();

        return studios.map((s) => {
            const assignment = s.assignments.find((a) => a.userId === userId);
            return {
                studioId: s._id,
                displayName: s.displayName,
                role: assignment.role,
                isPrimaryContact: assignment.isPrimaryContact,
            };
        });
    }

    async addStudioAssignment(assignment: StudioAssignment): Promise<void> {
        const studio = await this._studios.findOne({
            _id: assignment.studioId,
        });

        if (!studio) {
            return;
        }

        studio.assignments.push(assignment);

        await this._studios.updateOne(
            {
                _id: assignment.studioId,
            },
            {
                $set: {
                    assignments: studio.assignments,
                },
            }
        );
    }

    async removeStudioAssignment(
        studioId: string,
        userId: string
    ): Promise<void> {
        const studio = await this._studios.findOne({
            _id: studioId,
        });

        if (!studio) {
            return;
        }

        studio.assignments = studio.assignments.filter(
            (a) => a.userId !== userId
        );

        await this._studios.updateOne(
            {
                _id: studioId,
            },
            {
                $set: {
                    assignments: studio.assignments,
                },
            }
        );
    }

    async updateStudioAssignment(assignment: StudioAssignment): Promise<void> {
        const studioId = assignment.studioId;
        const userId = assignment.userId;
        const studio = await this._studios.findOne({
            _id: studioId,
        });

        if (!studio) {
            return;
        }

        const index = studio.assignments.findIndex((a) => a.userId === userId);

        if (index < 0) {
            return;
        }
        studio.assignments[index] = assignment;

        await this._studios.updateOne(
            {
                _id: studioId,
            },
            {
                $set: {
                    assignments: studio.assignments,
                },
            }
        );
    }

    async listStudioAssignments(
        studioId: string,
        filters?: ListStudioAssignmentFilters
    ): Promise<ListedStudioAssignment[]> {
        let query: FilterQuery<MongoDBStudio> = {
            _id: studioId,
        };

        if (hasValue(filters?.role)) {
            query['assignments.role'] = filters.role;
        }

        if (hasValue(filters?.userId)) {
            query['assignments.userId'] = filters.userId;
        }

        if (hasValue(filters?.isPrimaryContact)) {
            query['assignments.isPrimaryContact'] = filters.isPrimaryContact;
        }

        const studio = await this._studios.findOne(query);

        if (!studio) {
            return [];
        }

        let assignments: ListedStudioAssignment[] = [];

        for (let a of studio.assignments) {
            let user = await this._auth.findUser(a.userId);
            if (!user) {
                continue;
            }
            assignments.push({
                studioId: a.studioId,
                userId: a.userId,
                isPrimaryContact: a.isPrimaryContact,
                role: a.role,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                },
            });
        }

        return assignments;
    }

    async listUserAssignments(userId: string): Promise<ListedUserAssignment[]> {
        const studios = await this._studios
            .find({
                assignments: {
                    $elemMatch: {
                        userId: userId,
                    },
                },
            })
            .toArray();

        let assignments: ListedUserAssignment[] = [];

        for (let s of studios) {
            for (let a of s.assignments.filter((a) => a.userId === userId)) {
                assignments.push({
                    userId: a.userId,
                    studioId: a.studioId,
                    isPrimaryContact: a.isPrimaryContact,
                    role: a.role,
                    displayName: s.displayName,
                });
            }
        }

        return assignments;
    }
}

export interface MongoDBStudio extends Studio {
    _id: string;
    assignments: StudioAssignment[];
}
