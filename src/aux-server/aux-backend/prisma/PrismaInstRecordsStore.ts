import {
    AddUpdatesResult,
    BranchRecord,
    BranchRecordWithInst,
    CurrentUpdates,
    InstRecord,
    InstRecordsStore,
    InstWithBranches,
    ReplaceUpdatesResult,
    StoredUpdates,
} from '@casual-simulation/aux-records';
import { PrismaClient } from '@prisma/client';

/**
 * Defines an inst records store that uses Prisma to store records.
 */
export class PrismaInstRecordsStore implements InstRecordsStore {
    private _prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this._prisma = prisma;
    }

    async getInstByName(recordName: string, inst: string): Promise<InstRecord> {
        const record = await this._prisma.instRecord.findUnique({
            where: {
                recordName_name: {
                    recordName: recordName,
                    name: inst,
                },
            },
        });

        if (!record) {
            return null;
        }

        return {
            inst: record.name,
            markers: record.markers,
            recordName: record.recordName,
        };
    }

    async getBranchByName(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<BranchRecordWithInst> {
        const b = await this._prisma.instBranch.findUnique({
            where: {
                recordName_instName_name: {
                    recordName,
                    instName: inst,
                    name: branch,
                },
            },
            select: {
                name: true,
                recordName: true,
                instName: true,
                inst: {
                    select: {
                        name: true,
                        recordName: true,
                        markers: true,
                    },
                },
                temporary: true,
            },
        });

        if (!b) {
            return null;
        }

        return {
            inst: b.instName,
            branch: b.name,
            recordName: b.recordName,
            linkedInst: {
                recordName: b.inst.recordName,
                inst: b.inst.name,
                markers: b.inst.markers,
            },
            temporary: b.temporary,
        };
    }

    async saveInst(inst: InstWithBranches): Promise<void> {
        await this._prisma.instRecord.upsert({
            where: {
                recordName_name: {
                    recordName: inst.recordName,
                    name: inst.inst,
                },
            },
            update: {
                markers: inst.markers,
            },
            create: {
                name: inst.inst,
                recordName: inst.recordName,
                markers: inst.markers,
            },
        });
    }

    async saveBranch(branch: BranchRecord): Promise<void> {
        await this._prisma.instBranch.upsert({
            where: {
                recordName_instName_name: {
                    recordName: branch.recordName,
                    instName: branch.inst,
                    name: branch.branch,
                },
            },
            update: {
                temporary: branch.temporary,
            },
            create: {
                name: branch.branch,
                recordName: branch.recordName,
                instName: branch.inst,
                temporary: branch.temporary,
            },
        });
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
}
