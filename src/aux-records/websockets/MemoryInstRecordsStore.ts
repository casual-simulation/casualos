import { up } from 'inquirer/lib/utils/readline';
import {
    AddUpdatesResult,
    ReplaceUpdatesResult,
    StoredUpdates,
    InstRecordsStore,
    InstWithBranches,
    InstRecord,
    BranchRecord,
    BranchRecordWithInst,
} from './InstRecordsStore';

/**
 * Defines an implementation of UpdatesStore which keeps everything in memory.
 */
export class MemoryInstRecordsStore implements InstRecordsStore {
    private _records: Map<string, Map<string, InstWithUpdates>> = new Map();

    maxAllowedInstSize: number = Infinity;

    async getInstByName(recordName: string, inst: string): Promise<InstRecord> {
        const i = this._getInst(recordName, inst);

        if (!i) {
            return null;
        }

        return {
            recordName: i.recordName,
            inst: i.inst,
            markers: i.markers,
        };
    }

    async getBranchByName(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<BranchRecordWithInst> {
        const i = this._getInst(recordName, inst);

        if (!i) {
            return null;
        }

        const b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            return null;
        }

        return {
            recordName: b.recordName,
            inst: b.inst,
            branch: b.branch,
            temporary: b.temporary,
            linkedInst: {
                recordName: i.recordName,
                inst: i.inst,
                markers: i.markers,
            },
        };
    }

    async saveInst(inst: InstWithBranches): Promise<void> {
        const r = this._getRecord(inst.recordName);
        const i = this._getInst(inst.recordName, inst.inst);

        const { branches, ...rest } = inst;

        let update = {
            ...(i ?? {}),
            ...rest,
        };

        if (branches) {
            update.branches = branches.map((b) => {
                return {
                    recordName: i.recordName,
                    inst: i.inst,
                    branch: b.branch,
                    temporary: b.temporary,
                    updates: {
                        updates: [],
                        timestamps: [],
                    },
                };
            });
        } else if (!update.branches) {
            update.branches = [];
        }

        r.set(inst.inst, update as any);
    }

    async saveBranch(branch: BranchRecord): Promise<void> {
        const i = this._getInst(branch.recordName, branch.inst);

        if (!i) {
            return;
        }

        const b = i.branches.find((b) => b.branch === branch.branch);

        if (!b) {
            i.branches.push({
                ...branch,
                updates: {
                    updates: [],
                    timestamps: [],
                },
            });
            return;
        }

        b.temporary = branch.temporary;
    }

    async getUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<StoredUpdates> {
        const i = this._getInst(recordName, inst);

        if (!i) {
            return {
                updates: [],
                timestamps: [],
            };
        }

        const b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            return {
                updates: [],
                timestamps: [],
            };
        }

        return {
            updates: b.updates.updates.slice(),
            timestamps: b.updates.timestamps.slice(),
        };
    }

    async countUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        const i = this._getInst(recordName, inst);

        if (!i) {
            return 0;
        }

        const b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            return 0;
        }

        return b.updates.updates.length;
    }

    async addUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updates: string[]
    ): Promise<AddUpdatesResult> {
        const r = this._records.get(recordName);

        if (!r) {
            return {
                success: false,
                errorCode: 'record_not_found',
                branch,
            };
        }

        const i = this._getInst(recordName, inst);

        if (!i) {
            return {
                success: false,
                errorCode: 'inst_not_found',
                branch,
            };
        }

        let b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            b = {
                branch,
                inst: i.inst,
                recordName: i.recordName,
                temporary: false,
                updates: {
                    updates: [],
                    timestamps: [],
                },
            };
            i.branches.push(b);
        }

        let storedUpdates = b.updates;

        let newSize = i.instSizeInBytes;
        for (let update of updates) {
            newSize += update.length;

            if (newSize > this.maxAllowedInstSize) {
                return {
                    success: false,
                    errorCode: 'max_size_reached',
                    branch,
                    maxBranchSizeInBytes: this.maxAllowedInstSize,
                    neededBranchSizeInBytes: newSize,
                };
            }
        }
        i.instSizeInBytes = newSize;

        for (let update of updates) {
            storedUpdates.updates.push(update);
            storedUpdates.timestamps.push(Date.now());
        }

        return {
            success: true,
        };
    }

    async replaceUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updatesToRemove: StoredUpdates,
        updatesToAdd: string[]
    ): Promise<ReplaceUpdatesResult> {
        const r = this._records.get(recordName);

        if (!r) {
            return {
                success: false,
                errorCode: 'record_not_found',
                branch,
            };
        }

        const i = this._getInst(recordName, inst);

        if (!i) {
            return {
                success: false,
                errorCode: 'inst_not_found',
                branch,
            };
        }

        let b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            b = {
                branch,
                inst: i.inst,
                recordName: i.recordName,
                temporary: false,
                updates: {
                    updates: [],
                    timestamps: [],
                },
            };
            i.branches.push(b);
        }

        const storedUpdates = b.updates;

        for (let u of updatesToRemove.updates) {
            let index = storedUpdates.updates.indexOf(u);
            if (index === -1) {
                continue;
            }
            storedUpdates.updates.splice(index, 1);
            storedUpdates.timestamps.splice(index, 1);
            i.instSizeInBytes -= u.length;
        }

        return this.addUpdates(recordName, inst, branch, updatesToAdd);
    }

    async deleteBranch(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        const r = this._records.get(recordName);

        if (!r) {
            return;
        }

        const i = this._getInst(recordName, inst);

        if (!i) {
            return;
        }

        const index = i.branches.findIndex((b) => b.branch === branch);
        if (index >= 0) {
            const b = i.branches[index];
            for (let update of b.updates.updates) {
                i.instSizeInBytes -= update.length;
            }
            i.branches.splice(index, 1);
        }
    }

    reset() {
        this._records = new Map();
        this.maxAllowedInstSize = Infinity;
    }

    private _getInst(recordName: string, inst: string): InstWithUpdates | null {
        let record = this._getRecord(recordName);
        return record.get(inst);
    }

    private _getRecord(recordName: string): Map<string, InstWithUpdates> {
        let record = this._records.get(recordName);
        if (!record) {
            record = new Map();
            this._records.set(recordName, record);
        }
        return record;
    }
}

export interface InstWithUpdates extends InstRecord {
    instSizeInBytes: number;
    branches: BranchWithUpdates[];
}

export interface BranchWithUpdates extends BranchRecord {
    updates: StoredUpdates;
}
