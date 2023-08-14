import { sortBy } from 'lodash';
import {
    ListStudioAssignmentFilters,
    ListedRecord,
    ListedStudio,
    ListedStudioAssignment,
    ListedUserAssignment,
    Record,
    RecordKey,
    RecordsStore,
    Studio,
    StudioAssignment,
} from './RecordsStore';
import { AuthStore } from './AuthStore';

export class MemoryRecordsStore implements RecordsStore {
    private _records: Record[] = [];
    private _recordKeys: RecordKey[] = [];
    private _studios: Studio[] = [];
    private _studioAssignments: StudioAssignment[] = [];

    private _auth: AuthStore;

    constructor(auth: AuthStore) {
        this._auth = auth;
    }

    get recordKeys() {
        return this._recordKeys;
    }

    async getRecordByName(name: string): Promise<Record> {
        const record = this._records.find((r) => r.name === name);
        return record;
    }

    async updateRecord(record: Record): Promise<void> {
        const existingRecordIndex = this._records.findIndex(
            (r) => r.name === record.name
        );
        if (existingRecordIndex >= 0) {
            this._records[existingRecordIndex] = record;
        }
    }

    async addRecord(record: Record): Promise<void> {
        const existingRecordIndex = this._records.findIndex(
            (r) => r.name === record.name
        );
        if (existingRecordIndex < 0) {
            this._records.push(record);
        }
    }

    async addRecordKey(key: RecordKey): Promise<void> {
        const existingKeyIndex = this._recordKeys.findIndex(
            (k) =>
                k.recordName === key.recordName &&
                k.secretHash === key.secretHash
        );
        if (existingKeyIndex < 0) {
            this._recordKeys.push(key);
        }
    }

    async getRecordKeyByRecordAndHash(
        recordName: string,
        hash: string
    ): Promise<RecordKey> {
        const key = this._recordKeys.find(
            (k) => k.recordName === recordName && k.secretHash == hash
        );
        return key;
    }

    async listRecordsByOwnerId(ownerId: string): Promise<ListedRecord[]> {
        return sortBy(
            this._records
                .filter((r) => r.ownerId === ownerId)
                .map((r) => ({
                    name: r.name,
                    ownerId: r.ownerId,
                    studioId: r.studioId,
                })),
            (r) => r.name
        );
    }

    async listRecordsByStudioId(studioId: string): Promise<ListedRecord[]> {
        return sortBy(
            this._records
                .filter((r) => r.studioId === studioId)
                .map((r) => ({
                    name: r.name,
                    ownerId: r.ownerId,
                    studioId: r.studioId,
                })),
            (r) => r.name
        );
    }

    async listRecordsByStudioIdAndUserId(
        studioId: string,
        userId: string
    ): Promise<ListedRecord[]> {
        return sortBy(
            this._records
                .filter((s) => {
                    if (s.studioId !== studioId) {
                        return false;
                    }

                    const isAssigned = this._studioAssignments.some(
                        (a) => a.studioId === studioId && a.userId === userId
                    );
                    return isAssigned;
                })
                .map((r) => ({
                    name: r.name,
                    ownerId: r.ownerId,
                    studioId: r.studioId,
                })),
            (r) => r.name
        );
    }

    async addStudio(studio: Studio): Promise<void> {
        const existingStudioIndex = this._studios.findIndex(
            (r) => r.id === studio.id
        );
        if (existingStudioIndex < 0) {
            this._studios.push(studio);
        }
    }

    async createStudioForUser(
        studio: Studio,
        adminId: string
    ): Promise<{
        studio: Studio;
        assignment: StudioAssignment;
    }> {
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
        const existingStudioIndex = this._studios.findIndex(
            (r) => r.id === studio.id
        );
        if (existingStudioIndex >= 0) {
            this._studios[existingStudioIndex] = studio;
        }
    }

    async getStudioById(id: string): Promise<Studio> {
        return this._studios.find((s) => s.id === id);
    }

    async getStudioByStripeCustomerId(customerId: string): Promise<Studio> {
        return this._studios.find((s) => s.stripeCustomerId === customerId);
    }

    async listStudiosForUser(userId: string): Promise<ListedStudio[]> {
        const assignments = await this.listUserAssignments(userId);
        const studios = await Promise.all(
            assignments.map(async (a) => {
                const s = await this.getStudioById(a.studioId);
                return {
                    ...s,
                    ...a,
                };
            })
        );
        return studios.map((s) => ({
            studioId: s.id,
            displayName: s.displayName,
            role: s.role,
            isPrimaryContact: s.isPrimaryContact,
        }));
    }

    async addStudioAssignment(assignment: StudioAssignment): Promise<void> {
        const existingAssignmentIndex = this._studioAssignments.findIndex(
            (r) =>
                r.studioId === assignment.studioId &&
                r.userId === assignment.userId
        );
        if (existingAssignmentIndex < 0) {
            this._studioAssignments.push(assignment);
        }
    }

    async removeStudioAssignment(
        studioId: string,
        userId: string
    ): Promise<void> {
        this._studioAssignments = this._studioAssignments.filter(
            (s) => s.studioId !== studioId || s.userId !== userId
        );
    }

    async updateStudioAssignment(assignment: StudioAssignment): Promise<void> {
        const existingAssignmentIndex = this._studioAssignments.findIndex(
            (r) =>
                r.studioId === assignment.studioId &&
                r.userId === assignment.userId
        );
        if (existingAssignmentIndex >= 0) {
            this._studioAssignments[existingAssignmentIndex] = assignment;
        }
    }

    async listStudioAssignments(
        studioId: string,
        filters?: ListStudioAssignmentFilters
    ): Promise<ListedStudioAssignment[]> {
        const assignments = this._studioAssignments.filter((s) => {
            const matchesRole = !filters?.role || s.role === filters.role;
            const matchesPrimaryContact =
                !filters?.isPrimaryContact ||
                s.isPrimaryContact === filters.isPrimaryContact;
            const matchesUserId =
                !filters?.userId || s.userId === filters.userId;
            return (
                s.studioId === studioId &&
                matchesRole &&
                matchesPrimaryContact &&
                matchesUserId
            );
        });

        let results: ListedStudioAssignment[] = [];

        for (let s of assignments) {
            const user = await this._auth.findUser(s.userId);
            if (!user) {
                continue;
            }
            results.push({
                studioId: s.studioId,
                userId: s.userId,
                isPrimaryContact: s.isPrimaryContact,
                role: s.role,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                },
            });
        }

        return results;
    }

    async listUserAssignments(userId: string): Promise<ListedUserAssignment[]> {
        const assignments = this._studioAssignments.filter(
            (s) => s.userId === userId
        );

        return assignments.map((s) => {
            const studio = this._studios.find(
                (studio) => studio.id === s.studioId
            );
            return {
                displayName: studio.displayName,
                studioId: s.studioId,
                userId: s.userId,
                isPrimaryContact: s.isPrimaryContact,
                role: s.role,
            };
        });
    }
}
