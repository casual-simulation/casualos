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

import type { DataRecordsStore } from '../DataRecordsStore';
import type { IQueue } from '../queue/Queue';
import type {
    SearchRecord,
    SearchRecordsStore,
    SearchRecordSync,
    SearchRecordSyncHistory,
} from './SearchRecordsStore';
import { traced } from '../tracing/TracingDecorators';
import { v7 as uuid, v5 as uuidv5 } from 'uuid';
import type { Result, SimpleError } from '@casual-simulation/aux-common';
import {
    failure,
    hasValue,
    isFailure,
    isSuccess,
    success,
} from '@casual-simulation/aux-common';
import type { SearchInterface } from './SearchInterface';

/**
 * Defines a queue that is able to sync search records.
 */
export class SearchSyncQueue {
    private _queue: IQueue<SearchSyncQueueEvent>;

    constructor(queue: IQueue<SearchSyncQueueEvent>) {
        this._queue = queue;
    }

    /**
     *
     * @param event
     */
    async queueEvent(name: string, event: SearchSyncQueueEvent): Promise<void> {
        await this._queue.add(name, event);
    }
}

const DOCUMENT_NAMESPACE = '36e15e17-0f44-4c07-ab84-22eafecc2614';

const TRACE_NAME = 'SearchSyncProcessor';

export interface SearchSyncProcessorConfig {
    batchSize: number;
    search: SearchRecordsStore;
    searchInterface: SearchInterface;
    data: DataRecordsStore;
    queue: IQueue<SearchSyncQueueEvent>;
}

export class SearchSyncProcessor {
    private _store: SearchRecordsStore;
    private _searchInterface: SearchInterface;
    private _data: DataRecordsStore;
    private _queue: IQueue<SearchSyncQueueEvent>;

    constructor(config: SearchSyncProcessorConfig) {
        this._store = config.search;
        this._searchInterface = config.searchInterface;
        this._data = config.data;
        this._queue = config.queue;
    }

    @traced(TRACE_NAME)
    async process(event: SearchSyncQueueEvent): Promise<void> {
        if (event.type === 'sync_search_record') {
            await this._syncSearchRecord(event);
        } else if (event.type === 'sync_item') {
            await this._syncItem(event);
        }
    }

    @traced(TRACE_NAME)
    private _syncItem(event: SyncItemEvent) {
        throw new Error('Method not implemented.');
    }

    @traced(TRACE_NAME)
    private async _syncSearchRecord(event: SyncSearchRecordEvent) {
        const searchRecord = await this._store.getItemByAddress(
            event.sync.searchRecordName,
            event.sync.searchRecordAddress
        );

        const result =
            event.sync.targetResourceKind === 'data'
                ? await this._syncDataRecord(event, searchRecord)
                : failure({
                      errorCode: 'not_supported',
                      errorMessage: `Unsupported target resource kind: ${event.sync.targetResourceKind}`,
                  });

        const runId = uuid();

        const history: SearchRecordSyncHistory = {
            id: runId,
            runId,
            syncId: event.sync.id,
            searchRecordAddress: event.sync.searchRecordAddress,
            searchRecordName: event.sync.searchRecordName,
            timeMs: Date.now(),
            errorMessage: isFailure(result) ? result.error.errorMessage : null,
            status: 'success',
            success: result.success,
            numAdded: 0,
            numUpdated: 0,
            numTotal: 0,
            numDeleted: 0,
            numErrored: 0,
        };

        if (isSuccess(result)) {
            history.numAdded = result.value.numAdded;
            history.numUpdated = result.value.numUpdated;
            history.numDeleted = result.value.numDeleted;
            history.numTotal = result.value.numTotal;
            history.numErrored = result.value.numErrored;
        }

        await this._store.createSyncHistory(history);
    }

    private async _syncDataRecord(
        event: SyncSearchRecordEvent,
        searchRecord: SearchRecord
    ): Promise<Result<SyncInfo, SimpleError>> {
        let startingAddress: string | null = null;

        let done = false;
        let numAdded = 0;
        let numUpdated = 0;
        let numDeleted = 0;
        let numErrored = 0;
        const count = 100;
        for (let iteration = 0; iteration < 1000; iteration++) {
            const data = await this._data.listDataByMarker({
                recordName: event.sync.targetRecordName,
                marker: event.sync.targetMarker,
                startingAddress,
                count,
            });

            if (data.success === false) {
                return failure(data);
            }

            for (let i = 0; i < data.items.length; i++) {
                const item = data.items[i];

                const mapped = mapItem(item.data, event.sync.targetMapping);
                if (isFailure(mapped)) {
                    numErrored++;
                    console.warn(
                        `Error mapping item at address ${item.address} in record ${event.sync.targetRecordName}: ${mapped.error.errorMessage}`
                    );
                    continue;
                }

                if (!hasValue(mapped.value.id)) {
                    const documentId = uuidv5(
                        `${event.sync.targetRecordName}:${item.address}`,
                        DOCUMENT_NAMESPACE
                    );
                    mapped.value.id = documentId;
                }
                await this._searchInterface.createDocument(
                    searchRecord.collectionName,
                    mapped.value,
                    'emplace'
                );
                numAdded++;
                if (i === data.items.length - 1) {
                    startingAddress = item.address;
                }
            }

            if (data.items.length < count) {
                done = true;
                break;
            }
        }

        if (!done) {
            return failure({
                errorCode: 'took_too_long',
                errorMessage:
                    'The record has too many items to sync in a single operation. Please reduce the number of items and try again.',
            });
        }

        return success({
            numAdded,
            numUpdated,
            numDeleted,
            numErrored,
            numTotal: numAdded + numUpdated + numDeleted + numErrored,
        });
    }
}

/**
 * Maps a object to another object using the given mapping.
 * Returns null if the mapping was not successful.
 *
 * @param item The item to map.
 * @param mapping The mapping to use.
 */
export function mapItem(
    item: object,
    mapping: [string, string][]
): Result<any, SimpleError> {
    const result: any = {};

    for (let i = 0; i < mapping.length; i++) {
        const [from, to] = mapping[i];

        const parts = from.split('.');
        let value: any = item;

        for (let p = 0; p < parts.length; p++) {
            let part = parts[p];
            if (p === 0 && part === '$') {
                continue;
            }

            const optional = part.endsWith('?');
            if (optional) {
                part = part.substring(0, part.length - 1);
            }

            if (Object.hasOwn(value, part)) {
                value = value[part];
            } else {
                // not found
                if (optional) {
                    value = null;
                    break;
                }

                const pathTilFailure = parts.slice(0, p);
                pathTilFailure.unshift('$');
                return failure({
                    errorCode: 'invalid_request',
                    errorMessage: `Property missing. Could not find '${part}' (full path: '${from}') on '${pathTilFailure.join(
                        '.'
                    )}'`,
                });
            }
        }

        if (value !== null && value !== undefined) {
            result[to] = value;
        }
    }

    return success(result);
}

interface SyncInfo {
    numAdded: number;
    numUpdated: number;
    numDeleted: number;
    numTotal: number;
    numErrored: number;
}

export type SearchSyncQueueEvent = SyncSearchRecordEvent | SyncItemEvent;

export interface SyncSearchRecordEvent {
    type: 'sync_search_record';

    /**
     * The search record that is being synced.
     */
    sync: SearchRecordSync;
}

// TODO: Support batch syncing
// export interface SyncBatchEvent {
//     type: 'sync_batch';

//     /**
//      * The sync that is being processed.
//      */
//     sync: SearchRecordSync;

//     /**
//      * The ID of the run that this sync is part of.
//      */
//     runId: string;

//     /**
//      * The number of items to skip in the batch.
//      */
//     skip: number;

//     /**
//      * The number of items to take in the batch.
//      */
//     take: number;
// }

export interface SyncItemEvent {
    type: 'sync_item';

    /**
     * The action that was performed on the item.
     */
    action: 'create' | 'update' | 'delete';

    /**
     * The name of the record that the item is in.
     */
    itemRecordName: string;

    /**
     * The kind of resource that the item is.
     */
    itemResourceKind: string;

    /**
     * The address of the item.
     */
    itemAddress: string;
}
