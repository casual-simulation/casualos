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
import type { Collection, FilterQuery } from 'mongodb';

export class MongoDBDataRecordsStore implements DataRecordsStore {
    private _collection: Collection<DataRecord>;

    constructor(collection: Collection<DataRecord>) {
        this._collection = collection;
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
        await this._collection.updateOne(
            {
                recordName: recordName,
                address: address,
            },
            {
                $set: {
                    recordName: recordName,
                    address: address,
                    data: data,
                    publisherId: publisherId,
                    subjectId: subjectId,
                    updatePolicy: updatePolicy,
                    deletePolicy: deletePolicy,
                    markers: markers,
                },
            },
            {
                upsert: true,
            }
        );

        return {
            success: true,
        };
    }

    async getData(
        recordName: string,
        address: string
    ): Promise<GetDataStoreResult> {
        const record = await this._collection.findOne({
            recordName: recordName,
            address: address,
        });

        if (record) {
            return {
                success: true,
                data: record.data,
                publisherId: record.publisherId,
                subjectId: record.subjectId,
                updatePolicy: record.updatePolicy,
                deletePolicy: record.deletePolicy,
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
        let query = {
            recordName: recordName,
        } as FilterQuery<DataRecord>;
        if (!!address) {
            query.address = { $gt: address };
        }
        const count = await this._collection.count({
            recordName: recordName,
        });
        const records = await this._collection
            .find(query)
            .map((r) => ({
                address: r.address,
                data: r.data,
                markers: r.markers,
            }))
            .toArray();

        return {
            success: true,
            items: records,
            totalCount: count,
            marker: null,
        };
    }

    async listDataByMarker(
        request: ListDataStoreByMarkerRequest
    ): Promise<ListDataStoreResult> {
        let query = {
            recordName: { $eq: request.recordName },
            markers: request.marker,
        } as FilterQuery<DataRecord>;
        if (!!request.startingAddress) {
            query.address = { $gt: request.startingAddress };
        }

        const count = await this._collection.count(query);
        const records = await this._collection
            .find(query)
            .map((r) => ({
                address: r.address,
                data: r.data,
                markers: r.markers,
            }))
            .toArray();

        return {
            success: true,
            items: records,
            totalCount: count,
            marker: request.marker,
        };
    }

    async eraseData(
        recordName: string,
        address: string
    ): Promise<EraseDataStoreResult> {
        const result = await this._collection.deleteOne({
            recordName: recordName,
            address: address,
        });

        if (result.deletedCount <= 0) {
            return {
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The data was not found.',
            };
        }
        return {
            success: true,
        };
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
