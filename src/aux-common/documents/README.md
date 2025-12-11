# Documents

Real-time collaborative document system for CasualOS. This folder contains a comprehensive framework for creating shared documents that can be synchronized between multiple clients using CRDT (Conflict-free Replicated Data Types) technology powered by Yjs.

## Overview

The `documents` module provides:

-   **Shared Documents**: Real-time collaborative editing with conflict-free merging
-   **Data Structures**: Shared maps, arrays, and rich text with observable changes
-   **Yjs Integration**: Full integration with Yjs CRDT library for robust synchronization
-   **Remote Sync**: Network synchronization via InstRecordsClient WebSocket
-   **Local Persistence**: IndexedDB storage with optional encryption
-   **Type Safety**: Full TypeScript types for all shared data structures
-   **Observable Changes**: RxJS observables for reactive updates
-   **Transaction Support**: Batch multiple changes for efficiency

## Main Exports

### SharedDocument (`SharedDocument.ts`)

Core interface for collaborative documents (706 lines):

```typescript
import {
    SharedDocument,
    SharedMap,
    SharedArray,
    SharedText,
    SharedType,
    SharedTypeChanges,
} from '@casual-simulation/aux-common/documents';

interface SharedDocument {
    // Document metadata
    recordName: string | null; // Record name or null for public
    address: string | null; // Document address (inst ID)
    branch: string; // Branch name
    clientId: number; // Unique client ID

    // Observables
    onVersionUpdated: Observable<CurrentVersion>;
    onError: Observable<any>;
    onEvents: Observable<Action[]>;
    onUpdates: Observable<string[]>;
    onStatusUpdated: Observable<StatusUpdate>;
    onClientError: Observable<ClientError>;

    // Connection
    connect(): void;

    // Get top-level data structures
    getMap<T>(name: string): SharedMap<T>;
    getArray<T>(name: string): SharedArray<T>;
    getText(name: string): SharedText;

    // Create new data structures
    createMap<T>(): SharedMap<T>;
    createArray<T>(): SharedArray<T>;
    createText(): SharedText;

    // Transactions
    transact(callback: () => void): void;

    // State management
    getStateUpdate(): InstUpdate;
    applyStateUpdates(updates: InstUpdate[]): void;
    applyUpdates(updates: string[]): void;
}
```

**SharedMap Interface**:

```typescript
interface SharedMap<T = any> {
    readonly size: number;
    readonly doc: SharedDocument;
    readonly parent: SharedType | null;

    // Map operations
    set(key: string, value: T): void;
    get(key: string): T;
    delete(key: string): void;
    has(key: string): boolean;
    clear(): void;

    // Conversion
    clone(): SharedMap<T>;
    toJSON(): { [key: string]: T };

    // Iteration
    forEach(callback: (value: T, key: string, map: SharedMap<T>) => void): void;
    [Symbol.iterator](): IterableIterator<[string, T]>;
    entries(): IterableIterator<[string, T]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<T>;

    // Observable changes
    readonly changes: Observable<SharedMapChanges<T>>;
    readonly deepChanges: Observable<SharedTypeChanges[]>;
}
```

**SharedArray Interface**:

```typescript
interface SharedArray<T = any> {
    readonly length: number;
    readonly size: number;
    readonly doc: SharedDocument;
    readonly parent: SharedType | null;

    // Array modifications
    insert(index: number, items: T[]): void;
    delete(index: number, count: number): void;
    applyDelta(delta: SharedArrayOp<T>[]): void;

    // Standard array methods
    push(...items: T[]): void;
    pop(): T | undefined;
    unshift(...items: T[]): void;
    shift(): T | undefined;
    get(index: number): T;
    slice(start?: number, end?: number): T[];
    splice(start: number, deleteCount: number, ...items: T[]): T[];

    // Functional methods
    toArray(): T[];
    toJSON(): T[];
    forEach(
        callback: (value: T, index: number, array: SharedArray<T>) => void
    ): void;
    map(callback: (value: T, index: number, array: SharedArray<T>) => T): T[];
    filter(
        predicate: (value: T, index: number, array: SharedArray<T>) => boolean
    ): T[];

    // Iteration
    [Symbol.iterator](): IterableIterator<T>;
    clone(): SharedArray<T>;

    // Observable changes
    readonly changes: Observable<SharedArrayChanges<T>>;
    readonly deepChanges: Observable<SharedTypeChanges[]>;
}
```

**SharedText Interface**:

```typescript
interface SharedText {
    readonly length: number;
    readonly doc: SharedDocument;
    readonly parent: SharedType | null;

    // Text modifications
    insert(index: number, text: string, attributes?: Record<string, any>): void;
    delete(index: number, count: number): void;
    applyDelta(delta: SharedTextDelta): void;
    toDelta(): SharedTextDelta;

    // Relative positions (for cursor tracking)
    encodeRelativePosition(index: number, assoc?: number): RelativePosition;
    decodeRelativePosition(position: RelativePosition): number;

    // Conversion
    slice(start?: number, end?: number): string;
    toString(): string;
    toJSON(): string;
    clone(): SharedText;

    // Observable changes
    readonly changes: Observable<SharedTextChanges>;
    readonly deepChanges: Observable<SharedTextChanges[]>;
}
```

**Change Events**:

```typescript
// Map changes
interface SharedMapChanges<T> {
    type: 'map';
    target: SharedMap<T>;
    changes: Map<string, SharedMapChange<T>>;
}

interface SharedMapChange<T> {
    action: 'add' | 'update' | 'delete';
    oldValue: T | undefined;
}

// Array changes
interface SharedArrayChanges<T> {
    type: 'array';
    target: SharedArray<T>;
    delta: SharedArrayOp<T>[]; // preserve, insert, or delete operations
}

// Text changes
interface SharedTextChanges {
    type: 'text';
    target: SharedText;
    delta: SharedTextDelta; // preserve, insert, or delete operations
}
```

### YjsSharedDocument (`YjsSharedDocument.ts`)

Local Yjs document implementation (838 lines):

```typescript
import {
    createYjsSharedDocument,
    YjsSharedDocument,
} from '@casual-simulation/aux-common/documents';

// Create a local-only Yjs document
const doc = createYjsSharedDocument({
    branch: 'main',
    localPersistence: {
        saveToIndexedDb: true,
        encryptionKey: 'my-secret-key',
    },
});

// Get shared data structures
const users = doc.getMap<User>('users');
const tasks = doc.getArray<Task>('tasks');
const notes = doc.getText('notes');

// Make changes
doc.transact(() => {
    users.set('user1', { name: 'Alice', email: 'alice@example.com' });
    tasks.push({ id: 1, title: 'Task 1', completed: false });
    notes.insert(0, 'Hello, world!');
});

// Subscribe to changes
users.changes.subscribe((changes) => {
    changes.changes.forEach((change, key) => {
        console.log(`${key}: ${change.action}`, change.oldValue);
    });
});
```

**Features**:

-   Local CRDT document with Yjs
-   Automatic conflict resolution
-   Transaction batching
-   IndexedDB persistence
-   Observable change streams
-   State snapshots and updates

### RemoteYjsSharedDocument (`RemoteYjsSharedDocument.ts`)

Network-synchronized Yjs document (387 lines):

```typescript
import { createRemoteClientYjsSharedDocument } from '@casual-simulation/aux-common/documents';

// Create a remote-synced document
const doc = createRemoteClientYjsSharedDocument(
    {
        recordName: 'myRecord',
        inst: 'myInst',
        branch: 'main',
        readOnly: false,
        static: false,
        temporary: false,
        markers: ['publicRead'],
        localPersistence: {
            saveToIndexedDb: true,
        },
    },
    {
        authSource: myAuthSource,
    },
    instRecordsClient
);

// Connect to remote server
doc.connect();

// Subscribe to connection status
doc.onStatusUpdated.subscribe((status) => {
    if (status.type === 'connection') {
        console.log('Connected:', status.connected);
    } else if (status.type === 'sync') {
        console.log('Synced:', status.synced);
    }
});

// Enable collaboration on a static document
await doc.enableCollaboration();
```

**Features**:

-   Real-time network synchronization
-   WebSocket-based updates via InstRecordsClient
-   Authentication and authorization
-   Connection state tracking
-   Automatic reconnection
-   Optimistic updates
-   Conflict-free merging
-   IndexedDB caching

**Document Modes**:

-   **Normal**: Full read/write with real-time sync
-   **Read-only**: Can observe but not modify
-   **Static**: Initial load only, no real-time updates
-   **Temporary**: No persistence, session-only
-   **Skip initial load**: Connect without loading data first

### SharedDocumentConfig (`SharedDocumentConfig.ts`)

Configuration for shared documents:

```typescript
import {
    SharedDocumentConfig,
    RemoteSharedDocumentConfig,
} from '@casual-simulation/aux-common/documents';

interface SharedDocumentConfig {
    recordName?: string | null; // Record name for private docs
    inst?: string | null; // Instance ID
    branch?: string; // Branch name
    readOnly?: boolean; // Read-only mode
    static?: boolean; // Static mode (no real-time)
    skipInitialLoad?: boolean; // Skip initial data load
    temporary?: boolean; // Temporary (no persistence)
    markers?: string[]; // Access markers for new insts

    localPersistence?: {
        saveToIndexedDb?: boolean; // Enable IndexedDB
        encryptionKey?: string; // Encryption key
    };
}

interface RemoteSharedDocumentConfig extends SharedDocumentConfig {
    host?: string; // Server host
    connectionProtocol?: RemoteCausalRepoProtocol; // Protocol type
}
```

**Configuration Examples**:

```typescript
// Public collaborative document
const publicConfig: SharedDocumentConfig = {
    inst: 'public-doc',
    branch: 'main',
};

// Private collaborative document
const privateConfig: SharedDocumentConfig = {
    recordName: 'myRecord',
    inst: 'private-doc',
    branch: 'main',
};

// Read-only document
const readOnlyConfig: SharedDocumentConfig = {
    inst: 'doc-123',
    branch: 'main',
    readOnly: true,
};

// Static snapshot (no updates)
const staticConfig: SharedDocumentConfig = {
    inst: 'doc-456',
    branch: 'main',
    static: true,
};

// Temporary session document
const tempConfig: SharedDocumentConfig = {
    inst: 'temp-doc',
    branch: 'main',
    temporary: true,
};

// With local persistence
const persistedConfig: SharedDocumentConfig = {
    inst: 'doc-789',
    branch: 'main',
    localPersistence: {
        saveToIndexedDb: true,
        encryptionKey: 'my-encryption-key',
    },
};
```

### SharedDocumentFactories (`SharedDocumentFactories.ts`)

Factory system for creating documents:

```typescript
import {
    createSharedDocument,
    SharedDocumentFactory,
    SharedDocumentServices,
} from '@casual-simulation/aux-common/documents';

interface SharedDocumentServices {
    authSource: PartitionAuthSource; // Authentication provider
}

// Create document with factory chain
const doc = await createSharedDocument(
    config,
    services,
    factory1,
    factory2,
    factory3
);

// Custom factory function
const myFactory: SharedDocumentFactory = (config, services) => {
    if (config.inst?.startsWith('custom-')) {
        return new CustomSharedDocument(config, services);
    }
    return null; // Try next factory
};
```

**Built-in Factories**:

-   `createRemoteClientYjsSharedDocument`: Creates remote-synced Yjs documents
-   `createYjsSharedDocument`: Creates local-only Yjs documents

## Usage Examples

### Creating a Collaborative Document

```typescript
import {
    createRemoteClientYjsSharedDocument,
    SharedDocument,
} from '@casual-simulation/aux-common/documents';

// Initialize document
const doc = createRemoteClientYjsSharedDocument(
    {
        recordName: 'myProject',
        inst: 'project-123',
        branch: 'main',
    },
    { authSource },
    instRecordsClient
);

// Connect and wait for sync
doc.connect();

await firstValueFrom(
    doc.onStatusUpdated.pipe(filter((u) => u.type === 'sync' && u.synced))
);

console.log('Document synchronized!');
```

### Using Shared Maps

```typescript
// Get or create a shared map
const userMap = doc.getMap<User>('users');

// Subscribe to changes
userMap.changes.subscribe((changes) => {
    changes.changes.forEach((change, key) => {
        switch (change.action) {
            case 'add':
                console.log(`Added user ${key}`);
                break;
            case 'update':
                console.log(`Updated user ${key}`, change.oldValue);
                break;
            case 'delete':
                console.log(`Deleted user ${key}`, change.oldValue);
                break;
        }
    });
});

// Make changes
userMap.set('alice', { name: 'Alice', age: 30 });
userMap.set('bob', { name: 'Bob', age: 25 });

// Read values
const alice = userMap.get('alice');
console.log('Alice:', alice);

// Check existence
if (userMap.has('charlie')) {
    console.log('Charlie exists');
}

// Iterate
userMap.forEach((user, id) => {
    console.log(`User ${id}:`, user);
});

for (const [id, user] of userMap) {
    console.log(`User ${id}:`, user);
}

// Convert to object
const allUsers = userMap.toJSON();
```

### Using Shared Arrays

```typescript
// Get or create a shared array
const taskArray = doc.getArray<Task>('tasks');

// Subscribe to changes
taskArray.changes.subscribe((changes) => {
    console.log('Array delta:', changes.delta);
    // Delta is array of: { type: 'preserve', count: N }
    //                    { type: 'insert', values: [...] }
    //                    { type: 'delete', count: N }
});

// Add items
taskArray.push(
    { id: 1, title: 'Task 1', completed: false },
    { id: 2, title: 'Task 2', completed: false }
);

// Insert at specific position
taskArray.insert(1, [{ id: 3, title: 'Task 1.5', completed: false }]);

// Remove items
taskArray.delete(0, 1); // Delete 1 item at index 0

// Array methods
const task = taskArray.get(0);
const firstTwo = taskArray.slice(0, 2);

// Functional operations
const completed = taskArray.filter((task) => task.completed);
const titles = taskArray.map((task) => task.title);

// Splice (like native array)
const removed = taskArray.splice(1, 2, newTask1, newTask2);

// Convert to array
const allTasks = taskArray.toArray();
```

### Using Shared Text

```typescript
// Get or create shared text
const editorText = doc.getText('editor');

// Subscribe to changes
editorText.changes.subscribe((changes) => {
    console.log('Text delta:', changes.delta);
    // Delta is array of: { type: 'preserve', count: N }
    //                    { type: 'insert', text: '...', attributes: {...} }
    //                    { type: 'delete', count: N }
});

// Insert text
editorText.insert(0, 'Hello, world!');

// Insert with formatting
editorText.insert(7, 'beautiful ', { bold: true, color: 'blue' });

// Delete text
editorText.delete(0, 6); // Delete "Hello,"

// Apply delta (batch operations)
editorText.applyDelta([
    { type: 'preserve', count: 5 },
    { type: 'insert', text: ' amazing', attributes: { italic: true } },
    { type: 'delete', count: 3 },
]);

// Cursor tracking with relative positions
const cursorPos = editorText.encodeRelativePosition(10);
// ... text changes occur ...
const newIndex = editorText.decodeRelativePosition(cursorPos);
console.log('Cursor moved to:', newIndex);

// Get text content
const content = editorText.toString();
const slice = editorText.slice(0, 10);
```

### Transaction Batching

```typescript
// Batch multiple operations into single transaction
doc.transact(() => {
    const users = doc.getMap('users');
    const tasks = doc.getArray('tasks');
    const notes = doc.getText('notes');

    users.set('user1', { name: 'Alice' });
    users.set('user2', { name: 'Bob' });

    tasks.push({ title: 'Task 1' });
    tasks.push({ title: 'Task 2' });

    notes.insert(0, 'Project notes...');
});
// All changes above are sent as a single update
```

### Nested Data Structures

```typescript
// Create nested structures
const rootMap = doc.getMap('root');

// Create nested map
const nestedMap = doc.createMap<string>();
nestedMap.set('key1', 'value1');
nestedMap.set('key2', 'value2');
rootMap.set('nested', nestedMap);

// Create nested array
const nestedArray = doc.createArray<number>();
nestedArray.push(1, 2, 3);
rootMap.set('numbers', nestedArray);

// Deep change observation
rootMap.deepChanges.subscribe((changes) => {
    // Fires for changes to rootMap OR any nested structures
    console.log('Deep changes:', changes);
});
```

### State Management

```typescript
// Get current state as snapshot
const snapshot = doc.getStateUpdate();
console.log('Snapshot:', snapshot);

// Apply updates from another source
doc.applyStateUpdates([update1, update2, update3]);

// Apply raw Yjs updates
doc.applyUpdates(['base64update1', 'base64update2']);

// Subscribe to all updates
doc.onUpdates.subscribe((updates) => {
    console.log('New updates:', updates);
    // Save to backend, sync to peers, etc.
});
```

### Error Handling

```typescript
// Handle errors
doc.onError.subscribe((error) => {
    console.error('Document error:', error);
});

// Handle client-specific errors
doc.onClientError.subscribe((error) => {
    if (error.type === 'max_inst_size_reached') {
        console.error('Document too large!');
    } else if (error.type === 'rate_limit_exceeded') {
        console.error('Rate limited!');
    }
});

// Handle connection issues
doc.onStatusUpdated.subscribe((status) => {
    if (status.type === 'connection' && !status.connected) {
        console.warn('Connection lost, retrying...');
    }
});
```

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    Documents System                           │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │        SharedDocument (Interface)                   │     │
│  │  - recordName, address, branch                      │     │
│  │  - getMap(), getArray(), getText()                  │     │
│  │  - createMap(), createArray(), createText()         │     │
│  │  - transact(), applyUpdates()                       │     │
│  │  - Observable streams                               │     │
│  └─────────────────────────────────────────────────────┘     │
│                       ▲                                        │
│                       │                                        │
│         ┌─────────────┴──────────────┐                        │
│         │                            │                        │
│  ┌──────┴──────────┐      ┌──────────┴─────────┐             │
│  │YjsSharedDocument│      │RemoteYjsShared     │             │
│  │  (Local Only)   │      │Document            │             │
│  │                 │      │  (Network Synced)  │             │
│  │  - Yjs Doc      │      │  - Yjs Doc         │             │
│  │  - IndexedDB    │      │  - InstRecordsClient│             │
│  │  - Transactions │      │  - WebSocket       │             │
│  └─────────────────┘      │  - IndexedDB       │             │
│                           │  - Auth            │             │
│                           │  - Connection State│             │
│                           └────────────────────┘             │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │         Shared Data Structures                      │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │     │
│  │  │ SharedMap<T> │  │SharedArray<T>│  │SharedText│  │     │
│  │  │              │  │              │  │          │  │     │
│  │  │ - set/get    │  │ - push/pop   │  │ - insert │  │     │
│  │  │ - delete     │  │ - insert     │  │ - delete │  │     │
│  │  │ - iterate    │  │ - delete     │  │ - format │  │     │
│  │  │ - changes    │  │ - slice      │  │ - cursor │  │     │
│  │  │ - deepChanges│  │ - changes    │  │ - changes│  │     │
│  │  └──────────────┘  └──────────────┘  └──────────┘  │     │
│  │                                                      │     │
│  │  All backed by Yjs CRDT types:                     │     │
│  │  - Automatic conflict resolution                    │     │
│  │  - Observable change streams (RxJS)                 │     │
│  │  - Nested structure support                         │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │       SharedDocumentConfig                          │     │
│  │  - recordName, inst, branch                         │     │
│  │  - readOnly, static, temporary                      │     │
│  │  - localPersistence (IndexedDB + encryption)        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │       Factory System                                │     │
│  │  - createSharedDocument()                           │     │
│  │  - Factory chain pattern                            │     │
│  │  - Service injection                                │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Key Concepts

### CRDT (Conflict-free Replicated Data Types)

Documents use Yjs CRDTs which provide:

-   **Automatic conflict resolution**: Multiple users can edit simultaneously
-   **Eventual consistency**: All clients converge to same state
-   **Offline support**: Changes merge correctly when reconnecting
-   **Operation-based**: Only transmits changes, not full state

### Observable Changes

All shared types emit change events via RxJS:

-   **changes**: Direct changes to the structure
-   **deepChanges**: Changes to the structure or any nested children
-   Subscribe to react to real-time updates

### Transaction Batching

Group multiple operations for efficiency:

```typescript
doc.transact(() => {
    // All changes here are batched into single update
    map.set('key1', 'value1');
    map.set('key2', 'value2');
    array.push(item1, item2, item3);
});
```

### Relative Positions

Track cursor positions in text that remain valid across edits:

```typescript
const pos = text.encodeRelativePosition(10);
// ... edits happen ...
const newIndex = text.decodeRelativePosition(pos);
// Cursor tracked correctly even if text before/after was edited
```

### Document Modes

-   **Normal**: Full read/write collaboration
-   **Read-only**: Can observe but not modify
-   **Static**: Snapshot without real-time updates
-   **Temporary**: Session-only, no persistence
-   **Skip initial load**: Connect without loading data

### Local Persistence

Documents can persist to IndexedDB:

-   Automatic background saving
-   Optional encryption
-   Fast startup (load from cache while syncing)
-   Survives page reloads

## Dependencies

This module depends on:

-   `yjs`: CRDT library for shared data structures
-   `rxjs`: Observable streams for change events
-   `base64-js`: Base64 encoding for update serialization
-   `@casual-simulation/aux-common/bots`: InstUpdate types
-   `@casual-simulation/aux-common/common`: Status and action types
-   `@casual-simulation/aux-common/websockets`: InstRecordsClient for network sync
-   `@casual-simulation/aux-common/yjs`: YjsIndexedDBPersistence for storage

## Integration Points

The documents module integrates with:

-   **aux-runtime**: Uses shared documents for collaborative bot editing
-   **aux-records**: Backend synchronizes document state via InstRecordsClient
-   **aux-web**: UI components subscribe to document changes for reactive updates
-   **aux-vm**: Virtual machines can share state via documents

## Related Packages

-   `@casual-simulation/aux-common/websockets`: Network client for remote sync
-   `@casual-simulation/aux-common/partitions`: Partition system using documents
-   `@casual-simulation/aux-common/yjs`: Yjs utilities and persistence
-   `@casual-simulation/aux-records`: Backend document storage and sync
