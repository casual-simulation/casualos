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
    CurrentUpdates,
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
        let i = this._getInst(recordName, inst);

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
        let i = this._getInst(inst.recordName, inst.inst);

        const { branches, ...rest } = inst;

        let update: InstWithUpdates = {
            branches: null,
            ...(i ?? {
                instSizeInBytes: 0,
            }),
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
                    archived: {
                        updates: [],
                        timestamps: [],
                    },
                };
            });
        } else if (!update.branches) {
            update.branches = [];
        }

        r.set(inst.inst, update);
    }

    async saveBranch(branch: BranchRecord): Promise<void> {
        let i = this._getInst(branch.recordName, branch.inst);

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
                archived: {
                    updates: [],
                    timestamps: [],
                },
            });
            return;
        }

        b.temporary = branch.temporary;
    }

    async getAllUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<CurrentUpdates> {
        const i = this._getInst(recordName, inst);

        if (!i) {
            return null;
        }

        const b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            return null;
        }

        return {
            updates: b.archived.updates.slice(),
            timestamps: b.archived.timestamps.slice(),
            instSizeInBytes: i.instSizeInBytes,
        };
    }

    async getCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<CurrentUpdates> {
        const i = this._getInst(recordName, inst);

        if (!i) {
            return null;
        }

        const b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            return null;
        }

        return {
            updates: b.updates.updates.slice(),
            timestamps: b.updates.timestamps.slice(),
            instSizeInBytes: i.instSizeInBytes,
        };
    }

    async getInstSize(recordName: string, inst: string): Promise<number> {
        const i = this._getInst(recordName, inst);

        if (!i) {
            return null;
        }

        return i.instSizeInBytes;
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
        recordName: string | null,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
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
                archived: {
                    updates: [],
                    timestamps: [],
                },
            };
            i.branches.push(b);
        }

        let storedUpdates = b.updates;

        const newSize = i.instSizeInBytes + sizeInBytes;

        if (newSize > this.maxAllowedInstSize) {
            return {
                success: false,
                errorCode: 'max_size_reached',
                branch,
                maxInstSizeInBytes: this.maxAllowedInstSize,
                neededInstSizeInBytes: newSize,
            };
        }
        i.instSizeInBytes = newSize;

        storedUpdates.updates.push(...updates);
        storedUpdates.timestamps.push(Date.now());

        const archivedUpdates = b.archived;
        archivedUpdates.updates.push(...updates);
        archivedUpdates.timestamps.push(Date.now());

        return {
            success: true,
        };
    }

    async replaceCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updateToAdd: string,
        sizeInBytes: number
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
                archived: {
                    updates: [],
                    timestamps: [],
                },
            };
            i.branches.push(b);
        }

        const storedUpdates = b.updates;
        storedUpdates.updates = [];
        storedUpdates.timestamps = [];

        return this.addUpdates(
            recordName,
            inst,
            branch,
            [updateToAdd],
            sizeInBytes
        );
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
    archived: StoredUpdates;
}
