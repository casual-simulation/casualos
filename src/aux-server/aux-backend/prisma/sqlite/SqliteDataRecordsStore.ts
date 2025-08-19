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
    DataRecordsStore,
    SetDataResult,
    GetDataStoreResult,
    EraseDataStoreResult,
    ListDataStoreResult,
    UserPolicy,
    ListDataStoreByMarkerRequest,
} from '@casual-simulation/aux-records';

import type { PrismaClient } from '../generated-sqlite';
import { Prisma } from '../generated-sqlite';
import z from 'zod';
import { convertMarkers } from '../Utils';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'SqliteDataRecordsStore';

export class SqliteDataRecordsStore implements DataRecordsStore {
    private _client: PrismaClient;
    private _collection:
        | PrismaClient['dataRecord']
        | PrismaClient['manualDataRecord'];

    constructor(client: PrismaClient, manualData: boolean = false) {
        this._client = client;
        this._collection = manualData
            ? client.manualDataRecord
            : client.dataRecord;
    }

    @traced(TRACE_NAME)
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
        await (this._collection.upsert as PrismaClient['dataRecord']['upsert'])(
            {
                where: {
                    recordName_address: {
                        recordName: recordName,
                        address: address,
                    },
                },
                create: dataRecord,
                update: dataRecord,
            }
        );

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async getData(
        recordName: string,
        address: string
    ): Promise<GetDataStoreResult> {
        const record = await (
            this._collection
                .findUnique as PrismaClient['dataRecord']['findUnique']
        )({
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
                markers: convertMarkers(record.markers),
            };
        }

        return {
            success: false,
            errorCode: 'data_not_found',
            errorMessage: 'The data was not found.',
        };
    }

    @traced(TRACE_NAME)
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

        const [count, records] = await Promise.all([
            (this._collection.count as PrismaClient['dataRecord']['count'])({
                where: {
                    recordName: recordName,
                },
            }),
            (
                this._collection
                    .findMany as PrismaClient['dataRecord']['findMany']
            )({
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
            }),
        ]);

        return {
            success: true,
            items: records.map((r) => ({
                address: r.address,
                data: r.data,
                markers: convertMarkers(r.markers),
            })),
            totalCount: count,
            marker: null,
        };
    }

    @traced(TRACE_NAME)
    async listDataByMarker(
        request: ListDataStoreByMarkerRequest
    ): Promise<ListDataStoreResult> {
        let query: Prisma.DataRecordWhereInput = {
            recordName: request.recordName,
            markers: { has: request.marker },
        };
        if (!!request.startingAddress) {
            query.address = { gt: request.startingAddress };
        }

        const [count, records] = await Promise.all([
            (this._collection.count as PrismaClient['dataRecord']['count'])({
                where: {
                    recordName: request.recordName,
                    markers: { has: request.marker },
                },
            }),
            (
                this._collection
                    .findMany as PrismaClient['dataRecord']['findMany']
            )({
                where: query,
                orderBy: {
                    address: 'asc',
                },
                select: {
                    address: true,
                    data: true,
                    markers: true,
                },
                take: request.count || 10,
            }),
        ]);

        return {
            success: true,
            items: records.map((r) => ({
                address: r.address,
                data: r.data,
                markers: convertMarkers(r.markers),
            })),
            totalCount: count,
            marker: null,
        };
    }

    @traced(TRACE_NAME)
    async eraseData(
        recordName: string,
        address: string
    ): Promise<EraseDataStoreResult> {
        try {
            await (
                this._collection.delete as PrismaClient['dataRecord']['delete']
            )({
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
