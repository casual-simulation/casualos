import { Observable, Subscription } from 'rxjs';
import {
    RelativePosition,
    SharedArray,
    SharedArrayChanges,
    SharedArrayDelta,
    SharedDocument,
    SharedMap,
    SharedMapChanges,
    SharedText,
    SharedTextChanges,
    SharedTextDelta,
    SharedType,
    SharedTypeChanges,
} from './SharedDocument';
import {
    createRelativePositionFromTypeIndex,
    createAbsolutePositionFromRelativePosition,
    AbstractType as YType,
    Map as YMap,
    Array as YArray,
    Text as YText,
    YMapEvent,
    YEvent,
    YArrayEvent,
    YTextEvent,
    Doc,
} from 'yjs';
import { InstRecordsClient } from '../websockets';
import { SharedDocumentConfig } from './SharedDocumentConfig';
import { PartitionAuthSource } from 'partitions';
import { YjsIndexedDBPersistence } from './YjsIndexedDBPersistence';

export class YjsSharedDocument implements SharedDocument {
    private _doc: Doc;
    private _recordName: string;
    private _address: string;
    private _branch: string;
    private _client: InstRecordsClient;
    private _synced: boolean;
    private _authorized: boolean;
    private _authSource: PartitionAuthSource;
    private _persistence: SharedDocumentConfig['localPersistence'];
    private _indexeddb: YjsIndexedDBPersistence;
    private _watchingBranch: boolean;
    private _sub: Subscription = new Subscription();

    get recordName(): string {
        return this._recordName;
    }

    get address(): string {
        return this._address;
    }

    get branch(): string {
        return this._branch;
    }

    get clientId(): number {
        return this._doc.clientID;
    }

    get closed() {
        return this._sub.closed;
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    constructor(
        client: InstRecordsClient,
        authSource: PartitionAuthSource,
        config: SharedDocumentConfig
    ) {
        this._client = client;
        this._doc = new Doc();
        Object.defineProperty(this._doc, '__sharedDoc', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._recordName = config.recordName;
        this._address = config.address;
        this._branch = config.branch;
        this._synced = false;
        this._authorized = false;
        this._authSource = authSource;
        this._persistence = config.localPersistence;
    }

    connect(): void {
        if (!this._persistence?.saveToIndexedDb) {
            console.log('[YjsSharedDocument] Using IndexedDB persistence');
            const name = `doc/${this._recordName ?? ''}/${this._address}/${
                this._branch
            }`;
            this._indexeddb = new YjsIndexedDBPersistence(name, this._doc);
        }

        this._watchBranch();
    }

    getMap<T = any>(name: string): SharedMap<T> {
        return new YjsSharedMap(this._doc.getMap(name));
    }

    getArray<T = any>(name: string): SharedArray<T> {
        return new YjsSharedArray(this._doc.getArray(name));
    }

    getText(name: string): SharedText {
        return new YjsSharedText(this._doc.getText(name));
    }

    createMap<T = any>(): SharedMap<T> {
        return new YjsSharedMap(new YMap<T>());
    }

    createArray<T = any>(): SharedArray<T> {
        return new YjsSharedArray(new YArray<T>());
    }

    private _watchBranch() {
        if (this._watchingBranch) {
            return;
        }
        this._watchingBranch = true;
        this._sub;
    }
}

function convertEvent(event: YEvent<any>): SharedTypeChanges {
    if (event instanceof YMapEvent) {
        return {
            type: 'map',
            target: (event.target as any).__sharedType as SharedMap<any>,
            changes: event.changes.keys,
        };
    } else if (event instanceof YArrayEvent) {
        return {
            type: 'array',
            target: (event.target as any).__sharedType as SharedArray<any>,
            delta: convertArrayDelta(event.delta),
        };
    } else if (event instanceof YTextEvent) {
        return {
            type: 'text',
            target: (event.target as any).__sharedType as SharedText,
            delta: convertTextDelta(event.delta),
        };
    }
    return null;
}

function convertArrayDelta<T>(
    delta: YArrayEvent<T>['delta']
): SharedArrayDelta<T> {
    let ops: SharedArrayDelta<T> = [];
    for (let op of delta) {
        if (op.insert) {
            ops.push({
                type: 'insert',
                values: op.insert as T[],
            });
        } else if (op.delete) {
            ops.push({
                type: 'delete',
                count: op.delete,
            });
        } else {
            ops.push({
                type: 'preserve',
                count: op.retain,
            });
        }
    }
    return ops;
}

function convertTextDelta<T>(delta: YTextEvent['delta']): SharedTextDelta {
    let ops: SharedTextDelta = [];
    for (let op of delta) {
        if (op.insert) {
            ops.push({
                type: 'insert',
                text: op.insert as string,
                attributes: op.attributes,
            });
        } else if (op.delete) {
            ops.push({
                type: 'delete',
                count: op.delete,
            });
        } else {
            ops.push({
                type: 'preserve',
                count: op.retain,
            });
        }
    }
    return ops;
}

function changesObservable(type: YType<any>): Observable<SharedTypeChanges> {
    return new Observable<SharedTypeChanges>((observer) => {
        const f = (event: YEvent<any>) => {
            observer.next(convertEvent(event));
        };
        type.observe(f);

        return () => {
            // Unsubscribe
            type.unobserve(f);
        };
    });
}

function deepChangesObservable(
    type: YType<any>
): Observable<SharedTypeChanges[]> {
    return new Observable<SharedTypeChanges[]>((observer) => {
        const f = (event: YEvent<any>[]) => {
            observer.next(event.map(convertEvent));
        };
        type.observeDeep(f);

        return () => {
            // Unsubscribe
            type.unobserveDeep(f);
        };
    });
}

export class YjsSharedMap<T> implements SharedMap<T> {
    private _map: YMap<T>;
    private _changes: Observable<SharedMapChanges<T>>;
    private _deepChanges: Observable<SharedTypeChanges[]>;

    get doc(): SharedDocument {
        return (this._map.doc as any)?.__sharedDoc as SharedDocument;
    }

    get parent(): SharedType {
        return (this._map.parent as any)?.__sharedType as SharedType;
    }

    get changes(): Observable<SharedMapChanges<T>> {
        return this._changes;
    }

    get deepChanges(): Observable<SharedTypeChanges[]> {
        return this._deepChanges;
    }

    constructor(map: YMap<T>);
    constructor(map: Map<string, T>);
    constructor(map: YMap<T> | Map<string, T>) {
        if (map instanceof YMap) {
            this._map = map;
        } else {
            this._map = new YMap(map);
        }
        Object.defineProperty(this._map, '__sharedType', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._changes = changesObservable(this._map) as Observable<
            SharedMapChanges<T>
        >;
        this._deepChanges = deepChangesObservable(this._map);
    }

    get size(): number {
        return this._map.size;
    }

    set(key: string, value: T): void {
        this._map.set(key, value);
    }

    get(key: string): T {
        return this._map.get(key);
    }

    delete(key: string): void {
        this._map.delete(key);
    }

    has(key: string): boolean {
        return this._map.has(key);
    }

    clear(): void {
        this._map.clear();
    }

    clone(): SharedMap<T> {
        return new YjsSharedMap(this._map.clone());
    }

    toJSON(): { [key: string]: T } {
        return this._map.toJSON();
    }

    forEach(
        callback: (value: T, key: string, map: SharedMap<T>) => void
    ): void {
        return this._map.forEach((value, key) => callback(value, key, this));
    }

    entries(): IterableIterator<[string, T]> {
        return this._map.entries();
    }
    keys(): IterableIterator<string> {
        return this._map.keys();
    }
    values(): IterableIterator<T> {
        return this._map.values();
    }
    [Symbol.iterator](): IterableIterator<[string, T]> {
        return this._map[Symbol.iterator]();
    }
}

export class YjsSharedArray<T> implements SharedArray<T> {
    private _arr: YArray<T>;
    private _changes: Observable<SharedArrayChanges<T>>;
    private _deepChanges: Observable<SharedTypeChanges[]>;

    get doc(): SharedDocument {
        return (this._arr.doc as any)?.__sharedDoc as SharedDocument;
    }

    get parent(): SharedType {
        return (this._arr.parent as any)?.__sharedType as SharedType;
    }

    get length(): number {
        return this._arr.length;
    }

    get size(): number {
        return this._arr.length;
    }

    get changes(): Observable<SharedArrayChanges<T>> {
        return this._changes;
    }

    get deepChanges(): Observable<SharedTypeChanges[]> {
        return this._deepChanges;
    }

    constructor(arr: YArray<T>);
    constructor(arr: Array<T>);
    constructor(arr: YArray<T> | Array<T>) {
        if (arr instanceof YArray) {
            this._arr = arr;
        } else {
            this._arr = YArray.from(arr);
        }
        Object.defineProperty(this._arr, '__sharedType', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._changes = changesObservable(this._arr) as Observable<
            SharedArrayChanges<T>
        >;
        this._deepChanges = deepChangesObservable(this._arr);
    }

    insert(index: number, items: T[]): void {
        this._arr.insert(index, items);
    }
    delete(index: number, count: number): void {
        this._arr.delete(index, count);
    }
    applyDelta(delta: SharedArrayDelta<T>): void {
        let index = 0;
        for (let op of delta) {
            if (op.type === 'preserve') {
                index += op.count;
            } else if (op.type === 'insert') {
                this._arr.insert(index, op.values);
                index += op.values.length;
            } else if (op.type === 'delete') {
                this._arr.delete(index, op.count);
            }
        }
    }
    push(items: T[]): void {
        this._arr.push(items);
    }
    unshift(items: T[]): void {
        this._arr.unshift(items);
    }
    get(index: number): T {
        return this._arr.get(index);
    }
    slice(start?: number, end?: number): T[] {
        return this._arr.slice(start, end);
    }

    toArray(): T[] {
        return this._arr.toArray();
    }

    toJSON(): T[] {
        return this._arr.toJSON();
    }

    forEach(
        callback: (value: T, index: number, array: SharedArray<T>) => void
    ): void {
        this._arr.forEach((value, index) => callback(value, index, this));
    }

    map(callback: (value: T, index: number, array: SharedArray<T>) => T): T[] {
        return this._arr.map((value, index) => callback(value, index, this));
    }

    filter(
        predicate: (value: T, index: number, array: SharedArray<T>) => boolean
    ): T[] {
        let arr: T[] = [];
        for (let i = 0; i < this._arr.length; i++) {
            const val = this._arr.get(i);
            if (predicate(val, i, this)) {
                arr.push(val);
            }
        }
        return arr;
    }

    clone(): SharedArray<T> {
        return new YjsSharedArray(this._arr.clone());
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this._arr[Symbol.iterator]();
    }
}

export class YjsSharedText implements SharedText {
    private _text: YText;
    private _changes: Observable<SharedTextChanges>;
    private _deepChanges: Observable<SharedTextChanges[]>;

    get doc(): SharedDocument {
        return (this._text.doc as any)?.__sharedDoc as SharedDocument;
    }

    get parent(): SharedType {
        return (this._text.parent as any)?.__sharedType as SharedType;
    }

    get length(): number {
        return this._text.length;
    }

    get size(): number {
        return this._text.length;
    }

    get changes(): Observable<SharedTextChanges> {
        return this._changes;
    }

    get deepChanges(): Observable<SharedTextChanges[]> {
        return this._deepChanges;
    }

    constructor(text: YText);
    constructor(text: string);
    constructor(text: YText | string) {
        if (text instanceof YText) {
            this._text = text;
        } else {
            this._text = new YText(text);
        }
        Object.defineProperty(this._text, '__sharedType', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._changes = changesObservable(
            this._text
        ) as Observable<SharedTextChanges>;
        this._deepChanges = deepChangesObservable(this._text) as Observable<
            SharedTextChanges[]
        >;
    }

    insert(
        index: number,
        text: string,
        attribtues?: Record<string, any>
    ): void {
        this._text.insert(index, text, attribtues);
    }
    delete(index: number, count: number): void {
        this._text.delete(index, count);
    }
    applyDelta(delta: SharedTextDelta): void {
        let d: YTextEvent['delta'] = [];
        for (let op of delta) {
            if (op.type === 'preserve') {
                d.push({ retain: op.count });
            } else if (op.type === 'insert') {
                d.push({ insert: op.text, attributes: op.attributes });
            } else if (op.type === 'delete') {
                d.push({ delete: op.count });
            }
        }
        this._text.applyDelta(d);
    }
    toDelta(): SharedTextDelta {
        return convertTextDelta(this._text.toDelta());
    }
    encodeRelativePosition(index: number, assoc?: number): RelativePosition {
        return createRelativePositionFromTypeIndex(this._text, index, assoc);
    }

    decodeRelativePosition(position: RelativePosition): number {
        const pos = createAbsolutePositionFromRelativePosition(
            position as any,
            this._text.doc
        );
        return pos.index;
    }

    slice(start?: number, end?: number): string {
        return this._text.toString().slice(start, end);
    }

    toString(): string {
        return this._text.toString();
    }

    toJSON(): string {
        return this._text.toJSON();
    }

    clone(): SharedText {
        return new YjsSharedText(this._text.clone());
    }
}
