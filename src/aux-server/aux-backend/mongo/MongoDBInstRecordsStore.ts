import {
    AddUpdatesResult,
    BranchRecord,
    BranchRecordWithInst,
    CurrentUpdates,
    InstRecordsStore,
    InstWithBranches,
    InstWithSubscriptionInfo,
    ListInstsStoreResult,
    ReplaceUpdatesResult,
    SaveBranchResult,
    SaveInstResult,
    StoredUpdates,
} from '@casual-simulation/aux-records';
import { Collection, FilterQuery } from 'mongodb';
import { MongoDBMetricsStore } from './MongoDBMetricsStore';

export class MongoDBInstRecordsStore implements InstRecordsStore {
    private _instRecords: Collection<MongoDBInstRecord>;
    private _branchRecords: Collection<MongoDBBranchRecord>;
    private _metricsStore: MongoDBMetricsStore;

    constructor(
        instRecords: Collection<MongoDBInstRecord>,
        branchRecords: Collection<MongoDBBranchRecord>
    ) {
        this._instRecords = instRecords;
        this._branchRecords = branchRecords;
    }

    async getInstByName(
        recordName: string,
        inst: string
    ): Promise<InstWithSubscriptionInfo> {
        const instRecord = await this._instRecords.findOne({
            recordName,
            name: inst,
        });

        if (!instRecord) {
            return null;
        }

        return {
            recordName: instRecord.recordName,
            inst: instRecord.name,
            markers: instRecord.markers,
        };
    }

    async listInstsByRecord(
        recordName: string,
        startingInst?: string
    ): Promise<ListInstsStoreResult> {
        let filter: FilterQuery<MongoDBInstRecord> = {
            recordName,
        };

        if (startingInst) {
            filter.name = {
                $gte: startingInst,
            };
        }

        const insts: MongoDBInstRecord[] = await this._instRecords
            .find(filter)
            .take(10)
            .toArray();

        const totalCount = await this._instRecords.count({
            recordName,
        });

        return {
            success: true,
            insts: insts.map((i) => ({
                recordName: i.recordName,
                inst: i.name,
                markers: i.markers,
            })),
            totalCount: totalCount,
        };
    }

    async getBranchByName(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<BranchRecordWithInst> {
        const branchRecord = await this._branchRecords.findOne({
            recordName,
            inst,
            branch,
        });

        if (!branchRecord) {
            return null;
        }

        const instInfo = await this.getInstByName(recordName, inst);

        return {
            recordName,
            inst,
            branch,
            temporary: branchRecord.temporary,
            linkedInst: instInfo ?? null,
        };
    }

    async saveInst(inst: InstWithBranches): Promise<SaveInstResult> {}

    saveBranch(branch: BranchRecord): Promise<SaveBranchResult> {
        throw new Error('Method not implemented.');
    }

    getCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<CurrentUpdates> {
        throw new Error('Method not implemented.');
    }

    getInstSize(recordName: string, inst: string): Promise<number> {
        throw new Error('Method not implemented.');
    }

    getAllUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<StoredUpdates> {
        throw new Error('Method not implemented.');
    }

    addUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<AddUpdatesResult> {
        throw new Error('Method not implemented.');
    }

    deleteBranch(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    replaceCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updateToAdd: string,
        sizeInBytes: number
    ): Promise<ReplaceUpdatesResult> {
        throw new Error('Method not implemented.');
    }

    deleteInst(recordName: string, inst: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
}

interface MongoDBInstRecord {
    _id: string;

    recordName: string;
    name: string;
    markers: string[];
}

interface MongoDBBranchRecord {
    _id: string;
    recordName: string;
    inst: string;
    branch: string;
    temporary: boolean;
    updates: MongoDBBranchUpdate[];
}

interface MongoDBBranchUpdate {
    updateData: string;
    sizeInBytes: number;
}
