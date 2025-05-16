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

// Copyright (c) 2014,2023
//   - Kevin Jahns <kevin.jahns@rwth-aachen.de>.
//   - Chair of Computer Science 5 (Databases & Information Systems), RWTH Aachen University, Germany
//   - Casual Simulation, Inc.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import type { Doc } from 'yjs';
import { applyUpdate, encodeStateAsUpdate, transact } from 'yjs';
import * as idb from 'lib0/indexeddb';
import type { Observable } from 'rxjs';
import { BehaviorSubject, filter, firstValueFrom, map } from 'rxjs';
import { v4 as uuid } from 'uuid';

const customStoreName = 'custom';
const updatesStoreName = 'updates';

export const PREFERRED_TRIM_SIZE = 500;

export type ApplyUpdatesCallback = (updatesStore: IDBObjectStore) => void;

export const fetchUpdates = async (
    idbPersistence: YjsIndexedDBPersistence,
    beforeApplyUpdatesCallback: ApplyUpdatesCallback = () => {},
    afterApplyUpdatesCallback: ApplyUpdatesCallback = () => {}
) => {
    const [updatesStore] = idb.transact(
        /** @type {IDBDatabase} */ idbPersistence.db,
        [updatesStoreName]
    ); // , 'readonly')

    const updates = await idb.getAll(
        updatesStore,
        idb.createIDBKeyRangeLowerBound(idbPersistence.dbref, false)
    );

    if (!idbPersistence.destroyed) {
        beforeApplyUpdatesCallback(updatesStore);

        transact(
            idbPersistence.doc,
            () => {
                updates.forEach((val) => applyUpdate(idbPersistence.doc, val));
            },
            idbPersistence,
            false
        );

        afterApplyUpdatesCallback(updatesStore);
    }

    const lastKey = await idb.getLastKey(updatesStore);
    idbPersistence.dbref = lastKey + 1;

    const cnt = await idb.count(updatesStore);
    idbPersistence.dbsize = cnt;

    return updatesStore;
};

export const storeState = (
    idbPersistence: YjsIndexedDBPersistence,
    forceStore = true
) =>
    fetchUpdates(idbPersistence).then((updatesStore) => {
        if (forceStore || idbPersistence.dbsize >= PREFERRED_TRIM_SIZE) {
            idb.addAutoKey(
                updatesStore,
                encodeStateAsUpdate(idbPersistence.doc)
            )
                .then(() =>
                    idb.del(
                        updatesStore,
                        idb.createIDBKeyRangeUpperBound(
                            idbPersistence.dbref,
                            true
                        )
                    )
                )
                .then(() =>
                    idb.count(updatesStore).then((cnt) => {
                        idbPersistence.dbsize = cnt;
                    })
                );
        }
    });

export const clearDocument = (name: string) => idb.deleteDB(name);

export interface YjsIndexedDBPersistenceOptions {
    /**
     * The ID of the persistence instance.
     */
    id?: string;

    /**
     * Whether to broadcast the changes using a broadcast channel.
     * The channel name is always formatted as `yjs/${name}`.
     *
     * Defaults to false.
     */
    broadcastChanges?: boolean;

    /**
     * The key that the updates should be encrypted with.
     * If not specified, then no encryption is provided.
     */
    // encryptionKey?: string;
}

/**
 * Defines a class that is able to persist a Yjs document to IndexedDB.
 */
export class YjsIndexedDBPersistence {
    private _doc: Doc;
    private _name: string;
    private _dbref: number;
    private _dbsize: number;
    private _destroyed: boolean;
    private _db: Promise<IDBDatabase>;
    private _storeTimeout: number;
    private _storeTimeoutId: any;
    private _onSyncChanged: BehaviorSubject<boolean>;
    private _channel: BroadcastChannel;
    private _whenSynced: Promise<void>;
    private _encryptionKey: string;
    private _id: string;
    private _initPromise: Promise<void>;
    db: IDBDatabase;

    get whenSynced() {
        return this._whenSynced;
    }

    get storeTimeout(): number {
        return this._storeTimeout;
    }

    set storeTimeout(val: number) {
        this._storeTimeout = val;
    }

    get onSyncChanged(): Observable<boolean> {
        return this._onSyncChanged;
    }

    get synced() {
        return this._onSyncChanged.value;
    }

    get destroyed() {
        return this._destroyed;
    }

    get doc() {
        return this._doc;
    }

    get dbref(): number {
        return this._dbref;
    }

    set dbref(val: number) {
        this._dbref = val;
    }

    get dbsize(): number {
        return this._dbsize;
    }

    set dbsize(val: number) {
        this._dbsize = val;
    }

    constructor(
        name: string,
        doc: Doc,
        options?: YjsIndexedDBPersistenceOptions
    ) {
        this._doc = doc;
        this._name = name;
        this._dbref = 0;
        this._dbsize = 0;
        this._destroyed = false;
        this.db = null;
        this._id = options?.id ?? uuid();
        this._onSyncChanged = new BehaviorSubject(false);
        this._db = idb.openDB(name, (db) =>
            idb.createStores(db, [
                ['updates', { autoIncrement: true }],
                ['custom'],
            ])
        );
        const broadcastChanges = options?.broadcastChanges ?? false;
        // this._encryptionKey = options?.encryptionKey ?? null;
        this._channel = broadcastChanges
            ? new BroadcastChannel(`yjs/${name}`)
            : null;
        this._whenSynced = firstValueFrom(
            this._onSyncChanged.pipe(
                filter((sync) => sync),
                map(() => undefined as any)
            )
        );

        this._initPromise = this._initDb();

        this._storeTimeout = 1000;
        this._storeTimeoutId = null;

        if (this._channel) {
            this._channel.addEventListener('message', (event) => {
                if (
                    event.data.type === 'update' &&
                    event.data.id !== this._id
                ) {
                    this._onSyncChanged.next(false);
                    this._fetchUpdates();
                }
            });
        }

        this._storeUpdate = this._storeUpdate.bind(this);
        this.destroy = this.destroy.bind(this);
        doc.on('update', this._storeUpdate);
        doc.on('destroy', this.destroy);
    }

    async waitForInit() {
        await this._initPromise;
    }

    private async _initDb() {
        const db = await this._db;
        this.db = db;
        await this._fetchUpdates();
    }

    private async _fetchUpdates() {
        await this._db;
        if (this._destroyed) {
            return;
        }
        const beforeApplyUpdatesCallback: ApplyUpdatesCallback = (
            updatesStore
        ) => idb.addAutoKey(updatesStore, encodeStateAsUpdate(this.doc));
        const afterApplyUpdatesCallback: ApplyUpdatesCallback = () => {
            if (this._destroyed) return this;
            this._onSyncChanged.next(true);
        };
        await fetchUpdates(
            this,
            beforeApplyUpdatesCallback,
            afterApplyUpdatesCallback
        );
    }

    private _storeUpdate(update: Uint8Array, origin: any) {
        if (this.db && origin !== this) {
            const [updatesStore] = idb.transact(this.db, [updatesStoreName]);
            idb.addAutoKey(updatesStore, update);
            if (++this._dbsize >= PREFERRED_TRIM_SIZE) {
                // debounce store call
                if (this._storeTimeoutId !== null) {
                    clearTimeout(this._storeTimeoutId);
                }
                this._storeTimeoutId = setTimeout(() => {
                    storeState(this, false);
                    this._storeTimeoutId = null;
                }, this._storeTimeout);
            }

            if (this._channel) {
                this._channel.postMessage({
                    type: 'update',
                    id: this._id,
                });
            }
        }
    }

    async destroy(): Promise<void> {
        if (this._storeTimeoutId) {
            clearTimeout(this._storeTimeoutId);
        }
        if (this._channel) {
            this._channel.close();
            this._channel = null;
        }

        this._doc.off('update', this._storeUpdate);
        this._doc.off('destroy', this.destroy);
        this._destroyed = true;

        const db = await this._db;
        db.close();
    }

    /**
     * Destroys this instance and removes all data from indexeddb.
     */
    async clearData(): Promise<void> {
        await this.destroy();
        idb.deleteDB(this._name);
    }

    /**
     * Retrieves a value from the IndexedDB database.
     * @param key - The key of the value to retrieve.
     * @returns A promise that resolves with the retrieved value.
     */
    async get(
        key: string | number | ArrayBuffer | Date
    ): Promise<string | number | ArrayBuffer | Date | any> {
        const db = await this._db;
        const [custom] = idb.transact(db, [customStoreName], 'readonly');
        return idb.get(custom, key);
    }

    /**
     * Sets a value in the IndexedDB database.
     * @param key The key to use for the value. Can be a string, number, ArrayBuffer, or Date.
     * @param value The value to store in the database.
     * @returns A Promise that resolves when the value has been successfully stored.
     */
    async set(
        key: string | number | ArrayBuffer | Date,
        value: any
    ): Promise<any> {
        const db = await this._db;
        const [custom] = idb.transact(db, [customStoreName]);
        return idb.put(custom, value, key);
    }

    /**
     * Deletes the value associated with the given key from the custom store.
     * @param key The key of the value to delete.
     * @returns A promise that resolves when the value has been deleted.
     */
    async del(key: string | number | ArrayBuffer | Date): Promise<void> {
        const db = await this._db;
        const [custom] = idb.transact(db, [customStoreName]);
        return idb.del(custom, key);
    }
}
