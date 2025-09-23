/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    AddUpdatesResult,
    BranchRecord,
    BranchRecordWithInst,
    CurrentUpdates,
    InstRecordsStore,
    InstWithBranches,
    InstWithSubscriptionInfo,
    ListInstsStoreResult,
    LoadedPackage,
    ReplaceUpdatesResult,
    SaveBranchResult,
    SaveInstResult,
    StoredUpdates,
} from '@casual-simulation/aux-records';
import type { PrismaClient } from './generated';
import { Prisma } from './generated';
import { v7 as uuid } from 'uuid';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'PrismaInstRecordsStore';

/**
 * Defines an inst records store that uses Prisma to store records.
 */
export class PrismaInstRecordsStore implements InstRecordsStore {
    private _prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this._prisma = prisma;
    }

    @traced(TRACE_NAME)
    async saveLoadedPackage(loadedPackage: LoadedPackage): Promise<void> {
        await this._prisma.loadedPackage.upsert({
            where: {
                id: loadedPackage.id,
            },
            create: {
                id: loadedPackage.id,
                instRecordName: loadedPackage.recordName,
                instName: loadedPackage.inst,
                branch: loadedPackage.branch,
                packageId: loadedPackage.packageId,
                packageVersionId: loadedPackage.packageVersionId,
                userId: loadedPackage.userId,
            },
            update: {
                instRecordName: loadedPackage.recordName,
                instName: loadedPackage.inst,
                branch: loadedPackage.branch,
                packageId: loadedPackage.packageId,
                packageVersionId: loadedPackage.packageVersionId,
                userId: loadedPackage.userId,
            },
        });
    }

    @traced(TRACE_NAME)
    async listLoadedPackages(
        recordName: string | null,
        inst: string
    ): Promise<LoadedPackage[]> {
        const loadedPackages = await this._prisma.loadedPackage.findMany({
            where: {
                instRecordName: recordName,
                instName: inst,
            },
        });

        return loadedPackages.map((p) => ({
            id: p.id,
            recordName: p.instRecordName,
            inst: p.instName,
            branch: p.branch,
            packageId: p.packageId,
            packageVersionId: p.packageVersionId,
            userId: p.userId,
        }));
    }

    @traced(TRACE_NAME)
    async isPackageLoaded(
        recordName: string | null,
        inst: string,
        packageId: string
    ): Promise<LoadedPackage | null> {
        const loaded = await this._prisma.loadedPackage.findFirst({
            where: {
                instRecordName: recordName,
                instName: inst,
                packageId: packageId,
            },
        });

        if (!loaded) {
            return null;
        }

        return {
            id: loaded.id,
            recordName: loaded.instRecordName,
            inst: loaded.instName,
            branch: loaded.branch,
            packageId: loaded.packageId,
            packageVersionId: loaded.packageVersionId,
            userId: loaded.userId,
        };
    }

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
    async listInstsByRecordAndMarker(
        recordName: string,
        marker: string,
        startingInst?: string | null
    ): Promise<ListInstsStoreResult> {
        let filter: Prisma.InstRecordWhereInput = {
            recordName: recordName,
            markers: {
                has: marker,
            },
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
                markers: {
                    has: marker,
                },
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

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
    async deleteInst(recordName: string, inst: string): Promise<void> {
        await this._prisma.instRecord.delete({
            where: {
                recordName_name: {
                    recordName,
                    name: inst,
                },
            },
        });
    }

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
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
            if (err instanceof Prisma.PrismaClientKnownRequestError) {
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

    @traced(TRACE_NAME)
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
            if (err instanceof Prisma.PrismaClientKnownRequestError) {
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

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
    async deleteBranch(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        try {
            await this._prisma.instBranch.delete({
                where: {
                    recordName_instName_name: {
                        recordName: recordName,
                        instName: inst,
                        name: branch,
                    },
                },
            });
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError) {
                if (err.code === 'P2025') {
                    // Record not found
                    return;
                } else {
                    throw err;
                }
            }
        }
    }

    @traced(TRACE_NAME)
    async replaceCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updateToAdd: string,
        sizeInBytes: number
    ): Promise<ReplaceUpdatesResult> {
        const branchUpdateId = uuid();
        try {
            // await this._prisma.$executeRaw`
            //     BEGIN;

            //     UPSERT INTO "InstBranch" ("recordName", "instName", "name", "temporary")
            //     VALUES (${recordName}, ${inst}, ${branch}, false)

            //     INSERT INTO "BranchUpdate" ("id", "recordName", "instName", "branchName", "updateData", "sizeInBytes")
            //     VALUES (${branchUpdateId}, ${recordName}, ${inst}, ${branch}, ${updateToAdd}, ${sizeInBytes})

            //     COMMIT;
            // `;
            await this._prisma.branchUpdate.create({
                data: {
                    id: branchUpdateId,
                    recordName: recordName,
                    instName: inst,
                    branchName: branch,
                    updateData: updateToAdd,
                    sizeInBytes,
                },
            });
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError) {
                if (err.code === 'P2003') {
                    // Foreign key violation
                    return {
                        success: false,
                        errorCode: 'inst_not_found',
                        branch: branch,
                    };
                }
                throw err;
            }
        }

        return {
            success: true,
        };
    }
}
