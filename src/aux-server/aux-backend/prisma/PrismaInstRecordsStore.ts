import {
    AddUpdatesResult,
    BranchRecord,
    BranchRecordWithInst,
    CurrentUpdates,
    InstRecord,
    InstRecordsStore,
    InstWithBranches,
    InstWithSubscriptionInfo,
    ListInstsStoreResult,
    ReplaceUpdatesResult,
    SaveBranchResult,
    SaveInstResult,
    StoredUpdates,
} from '@casual-simulation/aux-records';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { v4 as uuid } from 'uuid';

/**
 * Defines an inst records store that uses Prisma to store records.
 */
export class PrismaInstRecordsStore implements InstRecordsStore {
    private _prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this._prisma = prisma;
    }

    async listInstsByRecord(
        recordName: string,
        startingInst?: string
    ): Promise<ListInstsStoreResult> {
        let filter: Prisma.InstRecordWhereInput = {
            recordName: recordName,
        };

        if (startingInst) {
            filter.name = {
                gt: startingInst,
            };
        }

        const insts = await this._prisma.instRecord.findMany({
            where: filter,
            orderBy: {
                name: 'asc',
            },
            take: 10,
            select: {
                name: true,
                markers: true,
            },
        });

        const totalCount = await this._prisma.instRecord.count({
            where: {
                recordName: recordName,
            },
        });

        return {
            success: true,
            insts: insts.map((i) => ({
                recordName: recordName,
                inst: i.name,
                markers: i.markers,
            })),
            totalCount,
        };
    }

    async getInstByName(
        recordName: string,
        inst: string
    ): Promise<InstWithSubscriptionInfo> {
        const record = await this._prisma.instRecord.findUnique({
            where: {
                recordName_name: {
                    recordName: recordName,
                    name: inst,
                },
            },
            select: {
                name: true,
                markers: true,
                recordName: true,
                record: {
                    select: {
                        owner: {
                            select: {
                                id: true,
                                subscriptionId: true,
                                subscriptionStatus: true,
                                subscriptionPeriodStart: true,
                                subscriptionPeriodEnd: true,
                            },
                        },
                        studio: {
                            select: {
                                id: true,
                                subscriptionId: true,
                                subscriptionStatus: true,
                                subscriptionPeriodStart: true,
                                subscriptionPeriodEnd: true,
                            },
                        },
                    },
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
            subscriptionId:
                record.record.owner?.subscriptionId ??
                record.record.studio?.subscriptionId,
            subscriptionStatus:
                record.record.owner?.subscriptionStatus ??
                record.record.studio?.subscriptionStatus,
            subscriptionType: record.record.owner ? 'user' : 'studio',
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
                        record: {
                            select: {
                                owner: {
                                    select: {
                                        id: true,
                                        subscriptionId: true,
                                        subscriptionStatus: true,
                                        subscriptionPeriodStart: true,
                                        subscriptionPeriodEnd: true,
                                    },
                                },
                                studio: {
                                    select: {
                                        id: true,
                                        subscriptionId: true,
                                        subscriptionStatus: true,
                                        subscriptionPeriodStart: true,
                                        subscriptionPeriodEnd: true,
                                    },
                                },
                            },
                        },
                    },
                },
                temporary: true,
            },
        });

        if (!b) {
            return null;
        }

        const record = b.inst.record;

        return {
            inst: b.instName,
            branch: b.name,
            recordName: b.recordName,
            linkedInst: {
                recordName: b.inst.recordName,
                inst: b.inst.name,
                markers: b.inst.markers,
                subscriptionId:
                    record.owner?.subscriptionId ??
                    record.studio?.subscriptionId,
                subscriptionStatus:
                    record.owner?.subscriptionStatus ??
                    record.studio?.subscriptionStatus,
                subscriptionType: record.owner ? 'user' : 'studio',
            },
            temporary: b.temporary,
        };
    }

    async saveInst(inst: InstWithBranches): Promise<SaveInstResult> {
        try {
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

            return {
                success: true,
            };
        } catch (err) {
            if (err instanceof PrismaClientKnownRequestError) {
                if (err.code === 'P2003') {
                    // Foreign key violation
                    return {
                        success: false,
                        errorCode: 'record_not_found',
                        errorMessage: 'The record was not found.',
                    };
                } else {
                    throw err;
                }
            }
        }
    }

    async saveBranch(branch: BranchRecord): Promise<SaveBranchResult> {
        try {
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

            return {
                success: true,
            };
        } catch (err) {
            if (err instanceof PrismaClientKnownRequestError) {
                if (err.code === 'P2003') {
                    // Foreign key violation
                    return {
                        success: false,
                        errorCode: 'inst_not_found',
                        errorMessage: 'The inst was not found.',
                    };
                } else {
                    throw err;
                }
            }
        }
    }

    async getCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<CurrentUpdates> {
        const updates = await this._prisma.branchUpdate.findMany({
            where: {
                recordName: recordName,
                instName: inst,
                branchName: branch,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 1,
        });

        return {
            updates: updates.map((u) => u.updateData),
            timestamps: updates.map((u) => u.createdAt.getTime()),
            instSizeInBytes: await this.getInstSize(recordName, inst),
        };
    }

    async getInstSize(recordName: string, inst: string): Promise<number> {
        const branches = await this._prisma.instBranch.findMany({
            where: {
                recordName: recordName,
                instName: inst,
            },
            select: {
                updates: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 1,
                    select: {
                        sizeInBytes: true,
                    },
                },
            },
        });

        let size: number = 0;
        for (let b of branches) {
            for (let u of b.updates) {
                size += u.sizeInBytes;
            }
        }

        return size;
    }

    async getAllUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<StoredUpdates> {
        const updates = await this._prisma.branchUpdate.findMany({
            where: {
                recordName: recordName,
                instName: inst,
                branchName: branch,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        return {
            updates: updates.map((u) => u.updateData),
            timestamps: updates.map((u) => u.createdAt.getTime()),
        };
    }

    async addUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<AddUpdatesResult> {
        throw new Error(
            'addUpdates() is not implemented for PrismaInstRecordsStore. Use replaceCurrentUpdates() instead.'
        );
    }

    async deleteBranch(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        await this._prisma.instBranch.delete({
            where: {
                recordName_instName_name: {
                    recordName: recordName,
                    instName: inst,
                    name: branch,
                },
            },
        });
    }

    async replaceCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updateToAdd: string,
        sizeInBytes: number
    ): Promise<ReplaceUpdatesResult> {
        await this._prisma.branchUpdate.create({
            data: {
                id: uuid(),
                recordName: recordName,
                instName: inst,
                branchName: branch,
                updateData: updateToAdd,
                sizeInBytes,
            },
        });

        return {
            success: true,
        };
    }
}
