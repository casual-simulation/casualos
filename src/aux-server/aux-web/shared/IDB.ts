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

export function openIDB(
    name: string,
    version: number,
    upgradeDb: (db: IDBDatabase, oldVersion: number) => void
): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open(name, version);

        request.onerror = (err) => {
            reject(err);
        };

        request.onupgradeneeded = (event) => {
            upgradeDb(request.result, event.oldVersion);
        };

        request.onsuccess = (ev) => {
            resolve(request.result);
        };
    });
}

/**
 * Puts the given item in the given database and store.
 * @param db The Database to put the item in.
 * @param store The store that the item should be put in.
 * @param item The item that should be placed in the store.
 * @param key The key that should be used for the item.
 * @returns
 */
export function putItem<T>(
    db: IDBDatabase,
    store: string,
    item: T,
    key?: string
) {
    return _transaction<T>(db, store, 'readwrite', (objs) =>
        objs.put(item, key)
    );
}

/**
 * Gets the item with the given key from the given database and store.
 */
export function getItem<T>(
    db: IDBDatabase,
    store: string,
    key: string
): Promise<T> {
    return _transaction<T>(db, store, 'readonly', (objs) => objs.get(key));
}

/**
 * Gets all the items from the given database and store.
 */
export function getItems<T>(db: IDBDatabase, store: string): Promise<T[]> {
    return _transaction<T[]>(db, store, 'readonly', (objs) => objs.getAll());
}

/**
 * Deletes the item with the given key from the given store and database.
 */
export function deleteItem(
    db: IDBDatabase,
    store: string,
    key: string
): Promise<void> {
    return _transaction<void>(db, store, 'readwrite', (objs) =>
        objs.delete(key)
    );
}

function _transaction<T>(
    db: IDBDatabase,
    store: string,
    mode: 'readonly' | 'readwrite',
    op: (obs: IDBObjectStore) => IDBRequest
): Promise<T> {
    let transaction = db.transaction(store, mode);
    let objs = transaction.objectStore(store);
    const p = _wrapRequest<T>(() => op(objs));
    transaction.commit();
    return p;
}

function _wrapRequest<T>(func: () => IDBRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const request = func();
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = (err) => {
            reject(err);
        };
    });
}
