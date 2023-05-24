import {
    Record,
    RecordsStore,
    DataRecordsStore,
    SetDataResult,
    GetDataStoreResult,
    EraseDataStoreResult,
    ListDataStoreResult,
    UserPolicy,
    cleanupObject,
} from '@casual-simulation/aux-records';
import {
    PrismaClient,
    DataRecord as PrismaDataRecord,
    Prisma,
} from '@prisma/client';
import z from 'zod';

export class PrismaDataRecordsStore implements DataRecordsStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    async setData(
        recordName: string,
        address: string,
        data: any,
        publisherId: string,
        subjectId: string,
        updatePolicy: UserPolicy,
        deletePolicy: UserPolicy,
        markers: string[]
    ): Promise<SetDataResult> {
        const dataRecord = {
            recordName: recordName,
            address: address,
            data: data,
            publisherId: publisherId,
            subjectId: subjectId,
            updatePolicy: updatePolicy as any,
            deletePolicy: deletePolicy as any,
            markers: markers,
        };
        await this._client.dataRecord.upsert({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address,
                },
            },
            create: dataRecord,
            update: dataRecord,
        });

        return {
            success: true,
        };
    }

    async getData(
        recordName: string,
        address: string
    ): Promise<GetDataStoreResult> {
        const record = await this._client.dataRecord.findUnique({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address,
                },
            },
        });

        if (record) {
            const policySchema = z.union([
                z.literal(true),
                z.array(z.string()),
                z.null(),
            ]);
            const updatePolicy = policySchema.safeParse(record.updatePolicy);
            const deletePolicy = policySchema.safeParse(record.deletePolicy);

            return {
                success: true,
                data: record.data,
                publisherId: record.publisherId,
                subjectId: record.subjectId,
                updatePolicy: updatePolicy.success ? updatePolicy.data : null,
                deletePolicy: deletePolicy.success ? deletePolicy.data : null,
                markers: record.markers,
            };
        }

        return {
            success: false,
            errorCode: 'data_not_found',
            errorMessage: 'The data was not found.',
        };
    }

    async listData(
        recordName: string,
        address: string
    ): Promise<ListDataStoreResult> {
        let query: Prisma.DataRecordWhereInput = {
            recordName: recordName,
        };
        if (!!address) {
            query.address = { gt: address };
        }
        const records = await this._client.dataRecord.findMany({
            where: query,
            orderBy: {
                address: 'asc',
            },
            select: {
                address: true,
                data: true,
                markers: true,
            },
            take: 10,
        });

        return {
            success: true,
            items: records,
        };
    }

    async eraseData(
        recordName: string,
        address: string
    ): Promise<EraseDataStoreResult> {
        try {
            await this._client.dataRecord.delete({
                where: {
                    recordName_address: {
                        recordName: recordName,
                        address: address,
                    },
                },
            });
            return {
                success: true,
            };
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError) {
                if (err.code === 'P2025') {
                    return {
                        success: false,
                        errorCode: 'data_not_found',
                        errorMessage: 'The data was not found.',
                    };
                }
            }
            throw err;
        }
    }
}

export interface DataRecord {
    recordName: string;
    address: string;
    data: any;
    publisherId: string;
    subjectId: string;
    updatePolicy: UserPolicy;
    deletePolicy: UserPolicy;
    markers: string[];
}
