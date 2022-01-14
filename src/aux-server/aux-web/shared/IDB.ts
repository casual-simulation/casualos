/**
 * Opens the given database from the IndexedDB.
 * @param name The name of the database to open.
 * @param version The version number to use for the DB.
 * @param upgradeDb A function that can upgrade the database to a new version.
 * @returns
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
 * @returns
 */
export function putItem<T>(db: IDBDatabase, store: string, item: T) {
    return _transaction<T>(db, store, 'readwrite', (objs) => objs.put(item));
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
