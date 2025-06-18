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
import {
    BehaviorSubject,
    Observable,
    startWith,
    Subject,
    Subscription,
} from 'rxjs';
import type { YEvent, RelativePosition } from 'yjs';
import {
    AbstractType as YType,
    Map as YMap,
    Array as YArray,
    Text as YText,
    YMapEvent,
    YArrayEvent,
    YTextEvent,
    createRelativePositionFromTypeIndex,
    createAbsolutePositionFromRelativePosition,
    Doc,
    applyUpdate,
    encodeStateAsUpdate,
} from 'yjs';
import type {
    SharedTypeChanges,
    SharedMap,
    SharedArray,
    SharedText,
    SharedArrayDelta,
    SharedTextDelta,
    SharedDocument,
    SharedType,
    SharedMapChanges,
    SharedArrayChanges,
    SharedTextChanges,
} from './SharedDocument';
import { fromByteArray, toByteArray } from 'base64-js';
import type { InstUpdate } from '../bots';
import type { CurrentVersion, Action, StatusUpdate } from '../common';
import type { ClientError, InstRecordsClient } from '../websockets';
import { YjsIndexedDBPersistence } from '../yjs/YjsIndexedDBPersistence';
import type { SharedDocumentConfig } from './SharedDocumentConfig';

export const APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN =
    '__apply_updates_to_inst';

/**
 * Creates a new YJS shared document.
 * @param config The config for the document.
 */
export function createYjsSharedDocument(
    config: SharedDocumentConfig
): YjsSharedDocument {
    return new YjsSharedDocument(config);
}

/**
 * Defines a shared document that is backed by a YJS document.
 */
export class YjsSharedDocument implements SharedDocument {
    protected _onVersionUpdated: BehaviorSubject<CurrentVersion>;
    protected _onUpdates: Subject<string[]> = new Subject<string[]>();

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();

    protected _onClientError = new Subject<ClientError>();
    protected _sub = new Subscription();

    protected _localId: number;
    protected _remoteId: number;
    protected _doc: Doc = new Doc();
    protected _client: InstRecordsClient;
    protected _currentVersion: CurrentVersion;

    protected _isLocalTransaction: boolean = true;
    protected _isRemoteUpdate: boolean = false;

    protected _recordName: string | null;
    protected _inst: string;
    protected _branch: string;
    protected _indexeddb: YjsIndexedDBPersistence;
    protected _persistence: SharedDocumentConfig['localPersistence'];
    private _maps: Map<string, YjsSharedMap<any>> = new Map();
    private _arrays: Map<string, YjsSharedArray<any>> = new Map();
    private _texts: Map<string, YjsSharedText> = new Map();

    get recordName(): string {
        return this._recordName;
    }

    get address(): string {
        return this._inst;
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

    get onVersionUpdated(): Observable<CurrentVersion> {
        return this._onVersionUpdated;
    }

    get onError(): Observable<any> {
        return this._onError;
    }

    get onEvents(): Observable<Action[]> {
        return this._onEvents;
    }

    get onClientError(): Observable<ClientError> {
        return this._onClientError;
    }

    get onStatusUpdated(): Observable<StatusUpdate> {
        return this._onStatusUpdated;
    }

    get site() {
        return this._currentSite;
    }

    get onUpdates() {
        return this._onUpdates.pipe(
            startWith([fromByteArray(encodeStateAsUpdate(this._doc))])
        );
    }

    get doc() {
        return this._doc;
    }

    protected get _remoteSite() {
        return this._remoteId.toString();
    }

    protected get _currentSite() {
        return this._localId.toString();
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    constructor(config: SharedDocumentConfig) {
        Object.defineProperty(this._doc, '__sharedDoc', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._branch = config.branch;
        this._persistence = config.localPersistence;

        this._localId = this._doc.clientID;
        this._remoteId = new Doc().clientID;
        this._currentVersion = {
            currentSite: this._localId.toString(),
            remoteSite: this._remoteId.toString(),
            vector: {},
        };
        this._onVersionUpdated = new BehaviorSubject<CurrentVersion>(
            this._currentVersion
        );
        this._onUpdates = new Subject<string[]>();
    }

    getMap<T = any>(name: string): SharedMap<T> {
        let map = this._maps.get(name);
        if (!map) {
            map = new YjsSharedMap(this._doc.getMap(name));
            this._maps.set(name, map);
        }
        return map;
    }

    getArray<T = any>(name: string): SharedArray<T> {
        let array = this._arrays.get(name);
        if (!array) {
            array = new YjsSharedArray(this._doc.getArray(name));
            this._arrays.set(name, array);
        }
        return array;
    }

    getText(name: string): SharedText {
        let text = this._texts.get(name);
        if (!text) {
            text = new YjsSharedText(this._doc.getText(name));
            this._texts.set(name, text);
        }
        return text;
    }

    createMap<T = any>(): SharedMap<T> {
        return new YjsSharedMap(new YMap<T>());
    }

    createArray<T = any>(): SharedArray<T> {
        return new YjsSharedArray(new YArray<T>());
    }

    async init(): Promise<void> {}

    connect(): void {
        if (this._persistence?.saveToIndexedDb && this._branch) {
            console.log('[YjsPartition] Using IndexedDB persistence');
            this._indexeddb = new YjsIndexedDBPersistence(
                this._branch,
                this._doc,
                { broadcastChanges: true }
            );
        }

        this._onStatusUpdated.next({
            type: 'connection',
            connected: true,
        });

        this._onStatusUpdated.next({
            type: 'authentication',
            authenticated: true,
        });

        this._onStatusUpdated.next({
            type: 'authorization',
            authorized: true,
        });

        if (this._indexeddb) {
            // wait to send the initial sync event until the persistence is ready
            this._indexeddb.waitForInit().then(() => {
                this._onStatusUpdated.next({
                    type: 'sync',
                    synced: true,
                });
            });
        } else {
            this._onStatusUpdated.next({
                type: 'sync',
                synced: true,
            });
        }
    }

    transact(callback: () => void): void {
        return this._doc.transact(callback);
    }

    getStateUpdate(): InstUpdate {
        const update: InstUpdate = {
            id: 0,
            timestamp: Date.now(),
            update: fromByteArray(encodeStateAsUpdate(this._doc)),
        };
        return update;
    }

    applyStateUpdates(updates: InstUpdate[]): void {
        this._applyUpdates(
            updates.map((u) => u.update),
            APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN
        );
    }

    /**
     * Applies the given updates to the YJS document.
     * @param updates The updates to apply.
     * @param transactionOrigin The origin of the transaction.
     */
    protected _applyUpdates(updates: string[], transactionOrigin?: string) {
        try {
            this._isRemoteUpdate = true;
            for (let updateBase64 of updates) {
                const update = toByteArray(updateBase64);
                applyUpdate(this._doc, update, transactionOrigin);
            }
        } finally {
            this._isRemoteUpdate = false;
        }
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

export class YjsSharedType<
    TType extends YType<any>,
    TChanges extends SharedTypeChanges
> {
    private _type: TType;
    private _changes: Observable<TChanges>;
    private _deepChanges: Observable<SharedTypeChanges[]>;

    get type() {
        return this._type;
    }

    get doc(): SharedDocument {
        return (this._type.doc as any)?.__sharedDoc as SharedDocument;
    }

    get parent(): SharedType {
        return (this._type.parent as any)?.__sharedType as SharedType;
    }

    get changes(): Observable<TChanges> {
        return this._changes;
    }

    get deepChanges(): Observable<SharedTypeChanges[]> {
        return this._deepChanges;
    }

    constructor(type: TType) {
        this._type = type;
        Object.defineProperty(this._type, '__sharedType', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._changes = changesObservable(this._type) as Observable<TChanges>;
        this._deepChanges = deepChangesObservable(this._type);
    }
}

export class YjsSharedMap<T>
    extends YjsSharedType<YMap<T>, SharedMapChanges<T>>
    implements SharedMap<T>
{
    constructor(map: YMap<T>);
    constructor(map: Map<string, T>);
    constructor(map: YMap<T> | Map<string, T>) {
        let ymap: YMap<T>;
        if (map instanceof YMap) {
            ymap = map;
        } else {
            ymap = new YMap(map);
        }
        super(ymap);
    }

    get size(): number {
        return this.type.size;
    }

    set(key: string, value: T): void {
        if (value instanceof YjsSharedType) {
            if (value.doc) {
                throw new Error(
                    'Cannot set a top-level map inside another map.'
                );
            }
            value = value.type;
        }
        this.type.set(key, value);
    }

    get(key: string): T {
        const val = this.type.get(key);
        return valueOrSharedType(val);
    }

    delete(key: string): void {
        this.type.delete(key);
    }

    has(key: string): boolean {
        return this.type.has(key);
    }

    clear(): void {
        this.type.clear();
    }

    clone(): SharedMap<T> {
        return new YjsSharedMap(this.type.clone());
    }

    toJSON(): { [key: string]: T } {
        return this.type.toJSON();
    }

    forEach(
        callback: (value: T, key: string, map: SharedMap<T>) => void
    ): void {
        return this.type.forEach((value, key) => callback(value, key, this));
    }

    entries(): IterableIterator<[string, T]> {
        return this.type.entries();
    }
    keys(): IterableIterator<string> {
        return this.type.keys();
    }
    values(): IterableIterator<T> {
        return this.type.values();
    }
    [Symbol.iterator](): IterableIterator<[string, T]> {
        return this.type[Symbol.iterator]();
    }
}

export class YjsSharedArray<T>
    extends YjsSharedType<YArray<T>, SharedArrayChanges<T>>
    implements SharedArray<T>
{
    get length(): number {
        return this.type.length;
    }

    get size(): number {
        return this.type.length;
    }

    constructor(arr: YArray<T>);
    constructor(arr: Array<T>);
    constructor(arr: YArray<T> | Array<T>) {
        let yarray: YArray<T>;
        if (arr instanceof YArray) {
            yarray = arr;
        } else {
            yarray = YArray.from(arr);
        }
        super(yarray);
    }

    insert(index: number, items: T[]): void {
        this.type.insert(index, this._mapItems(items));
    }
    delete(index: number, count: number): void {
        this.type.delete(index, count);
    }
    applyDelta(delta: SharedArrayDelta<T>): void {
        let index = 0;
        for (let op of delta) {
            if (op.type === 'preserve') {
                index += op.count;
            } else if (op.type === 'insert') {
                this.type.insert(index, op.values);
                index += op.values.length;
            } else if (op.type === 'delete') {
                this.type.delete(index, op.count);
            }
        }
    }
    push(...items: T[]): void {
        this.type.push(this._mapItems(items));
    }
    pop(): T | undefined {
        let lastIndex = this.type.length - 1;
        if (lastIndex < 0) {
            return undefined;
        } else {
            const lastItem = this.type.get(lastIndex);
            this.type.delete(lastIndex, 1);
            return lastItem;
        }
    }
    unshift(...items: T[]): void {
        this.type.unshift(this._mapItems(items));
    }
    shift(): T | undefined {
        if (this.type.length <= 0) {
            return undefined;
        } else {
            const firstItem = this.type.get(0);
            this.type.delete(0, 1);
            return firstItem;
        }
    }
    get(index: number): T {
        return valueOrSharedType(this.type.get(index));
    }
    slice(start?: number, end?: number): T[] {
        return this.type.slice(start, end);
    }
    splice(start: number, deleteCount?: number, ...items: T[]): T[] {
        if (this.type.length <= 0) {
            if (items.length > 0) {
                this.push(...items);
            }
            return [];
        }

        const len = this.type.length;
        if (start < -len) {
            start = 0;
        } else if (-len <= start && start < 0) {
            start = len + start;
        } else if (start >= len) {
            start = len;
        }

        if (start >= len) {
            deleteCount = 0;
        } else if (typeof deleteCount === 'undefined') {
            deleteCount = 0;
        } else if (deleteCount >= len - start) {
            deleteCount = len - start;
        } else if (deleteCount < 0) {
            deleteCount = 0;
        }

        let deleted: T[] = [];
        if (deleteCount > 0) {
            deleted = this.type.slice(start, start + deleteCount);
            this.delete(start, deleteCount);
        }

        if (items.length > 0) {
            this.insert(start, items);
        }

        return deleted;
    }

    toArray(): T[] {
        return this.type.toArray();
    }

    toJSON(): T[] {
        return this.type.toJSON();
    }

    forEach(
        callback: (value: T, index: number, array: SharedArray<T>) => void
    ): void {
        this.type.forEach((value, index) => callback(value, index, this));
    }

    map(callback: (value: T, index: number, array: SharedArray<T>) => T): T[] {
        return this.type.map((value, index) => callback(value, index, this));
    }

    filter(
        predicate: (value: T, index: number, array: SharedArray<T>) => boolean
    ): T[] {
        let arr: T[] = [];
        for (let i = 0; i < this.type.length; i++) {
            const val = this.type.get(i);
            if (predicate(val, i, this)) {
                arr.push(val);
            }
        }
        return arr;
    }

    clone(): SharedArray<T> {
        return new YjsSharedArray(this.type.clone());
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this.type[Symbol.iterator]();
    }

    private _mapItems(items: T[]): T[] {
        let containsSharedType = false;
        for (let i of items) {
            if (i instanceof YjsSharedType) {
                if (i.doc) {
                    throw new Error(
                        'Cannot push a top-level array inside another array.'
                    );
                }
                containsSharedType = true;
                break;
            }
        }

        if (containsSharedType) {
            items = items.map((i) => (i instanceof YjsSharedType ? i.type : i));
        }
        return items;
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

function valueOrSharedType(val: any) {
    if (val instanceof YType) {
        return (val as any).__sharedType;
    }
    return val;
}
