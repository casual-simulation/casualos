# Yjs

Yjs utilities and persistence layer for CasualOS. This folder provides helper functions for working with Yjs CRDTs and IndexedDB persistence for offline-first collaborative editing.

## Overview

The `yjs` module provides:

-   **Helper Functions**: Utilities for working with Yjs state vectors, version vectors, and text operations
-   **IndexedDB Persistence**: Local storage for Yjs documents with automatic synchronization
-   **State Vector Operations**: Create relative/absolute positions from version vectors
-   **Document Trimming**: Automatic compression of update history
-   **Broadcast Channel**: Cross-tab synchronization for same-origin collaboration
-   **Custom Storage**: Key-value storage alongside Yjs document data

This module is used by YjsPartition and RemoteYjsPartition to enable offline-capable, real-time collaborative editing.

## Main Exports

### YjsHelpers (`YjsHelpers.ts`)

Utility functions for Yjs document manipulation (177 lines):

```typescript
import {
    getStateVector,
    getClock,
    createRelativePositionFromStateVector,
    createAbsolutePositionFromStateVector,
    getTextChar,
} from '@casual-simulation/aux-common/yjs';
import type { VersionVector } from '@casual-simulation/aux-common/common';
import type { Doc, Text } from 'yjs';

// Get state vector (version vector)
const doc = new Y.Doc();
const stateVector = getStateVector(doc);
// Returns: { '123': 5, '456': 10 } - client IDs mapped to clock values
// Clock value = next expected update ID for that client

// Get clock for specific client
const clientClock = getClock(doc, 123);
// Returns: 5 (next expected clock for client 123)
// Returns: undefined if client has no updates

// Create relative position from state vector
const text = doc.getText('content');
const relativePos = createRelativePositionFromStateVector(
    text,
    stateVector,
    10, // Character index
    0, // Association (0 = right, -1 = left)
    false // Include deleted characters
);

// Create absolute position from state vector
const absolutePos = createAbsolutePositionFromStateVector(
    doc,
    text,
    stateVector,
    10, // Character index
    0, // Association
    false // Include deleted
);
// Returns: { index: 10, assoc: 0 } or null

// Get character at index
const char = getTextChar(text, 5);
// Returns: 'h' (character at index 5)
// Returns: null if index out of bounds
```

**Key Functions**:

**`getStateVector(doc: Doc): VersionVector`**

-   Returns map of client IDs to their latest clock values
-   Clock = next expected update ID for that client
-   Used for synchronization and conflict detection
-   Format: `{ [clientId: string]: number }`

**`getClock(doc: Doc, client: number): number | undefined`**

-   Gets the latest clock value for specific client
-   Returns undefined if client has no updates
-   Used for checking client synchronization state

**`createRelativePositionFromStateVector()`**

-   Creates position relative to state vector (for CRDTs)
-   Parameters:
    -   `text`: Yjs Text object
    -   `vector`: Version vector (state at specific point in time)
    -   `index`: Character index
    -   `assoc`: Association (-1 = left, 0 = right)
    -   `includeDeleted`: Include deleted characters in calculation
-   Returns: RelativePosition object
-   Used for operational transforms and tag edits

**`createAbsolutePositionFromStateVector()`**

-   Converts relative position to absolute index
-   Same parameters as createRelativePositionFromStateVector
-   Returns: `{ index: number, assoc: number }` or null
-   Used for converting CRDT positions to array indices

**`getTextChar(type: Text, index: number): string | null`**

-   Gets character at specific index in Yjs Text
-   Skips deleted characters
-   Returns null if index out of bounds
-   Used for character-level text inspection

### YjsIndexedDBPersistence (`YjsIndexedDBPersistence.ts`)

IndexedDB persistence for Yjs documents (380 lines):

```typescript
import {
    YjsIndexedDBPersistence,
    clearDocument,
    PREFERRED_TRIM_SIZE,
} from '@casual-simulation/aux-common/yjs';
import * as Y from 'yjs';

// Create Yjs document
const doc = new Y.Doc();

// Create persistence instance
const persistence = new YjsIndexedDBPersistence(
    'my-document', // Database name
    doc, // Yjs document
    {
        id: 'client-123', // Optional client ID
        broadcastChanges: true, // Enable cross-tab sync
    }
);

// Wait for initial sync
await persistence.whenSynced;
console.log('Document loaded from IndexedDB');

// Subscribe to sync changes
persistence.onSyncChanged.subscribe((synced) => {
    if (synced) {
        console.log('Document synced with IndexedDB');
    } else {
        console.log('Syncing...');
    }
});

// Check sync status
if (persistence.synced) {
    console.log('Currently synced');
}

// Make changes (automatically persisted)
const text = doc.getText('content');
text.insert(0, 'Hello, world!');
// Update automatically saved to IndexedDB

// Store custom key-value data
await persistence.set('metadata', { author: 'Alice', version: 1 });

// Retrieve custom data
const metadata = await persistence.get('metadata');
console.log('Metadata:', metadata);

// Delete custom data
await persistence.del('metadata');

// Adjust store timeout (debounce)
persistence.storeTimeout = 2000; // 2 seconds

// Clean up
await persistence.destroy();

// Clear all data
await persistence.clearData();

// Clear document by name (static method)
await clearDocument('my-document');
```

**Constructor Options**:

```typescript
interface YjsIndexedDBPersistenceOptions {
    /**
     * Client ID for broadcast channel identification
     */
    id?: string;

    /**
     * Enable cross-tab synchronization via BroadcastChannel
     * Channel name: `yjs/${documentName}`
     * Defaults to false
     */
    broadcastChanges?: boolean;
}
```

**Key Properties**:

-   `synced: boolean` - Current sync status
-   `destroyed: boolean` - Whether instance is destroyed
-   `doc: Doc` - Yjs document being persisted
-   `dbref: number` - Current database reference counter
-   `dbsize: number` - Number of updates in database
-   `storeTimeout: number` - Debounce timeout for storing (default: 1000ms)
-   `db: IDBDatabase` - IndexedDB database instance

**Key Methods**:

**`whenSynced: Promise<void>`**

-   Promise that resolves when document is initially synced
-   Use for startup synchronization
-   Example: `await persistence.whenSynced`

**`onSyncChanged: Observable<boolean>`**

-   Observable stream of sync status changes
-   Emits `true` when synced, `false` when syncing
-   Use for UI indicators

**`waitForInit(): Promise<void>`**

-   Wait for initialization to complete
-   Ensures database is ready before operations

**`get(key): Promise<any>`**

-   Retrieve custom key-value data
-   Key types: string, number, ArrayBuffer, Date
-   Stored in separate 'custom' object store

**`set(key, value): Promise<void>`**

-   Store custom key-value data
-   Persists alongside Yjs document updates
-   Use for metadata, timestamps, etc.

**`del(key): Promise<void>`**

-   Delete custom key-value data
-   Removes from 'custom' object store

**`destroy(): Promise<void>`**

-   Clean up event listeners and close database
-   Does NOT delete data (use clearData for that)
-   Call before discarding instance

**`clearData(): Promise<void>`**

-   Destroys instance AND deletes all IndexedDB data
-   Removes both updates and custom stores
-   Cannot be undone

**Database Structure**:

```typescript
// Two object stores:
{
    updates: {
        // Auto-incrementing keys
        1: Uint8Array,  // Yjs update 1
        2: Uint8Array,  // Yjs update 2
        // ... more updates
    },
    custom: {
        // User-defined keys
        'metadata': { author: 'Alice' },
        'timestamp': 1234567890,
        // ... custom data
    }
}
```

**Update Trimming**:

-   When `dbsize >= PREFERRED_TRIM_SIZE` (500), trimming triggers
-   Encodes entire document state as single update
-   Deletes old individual updates
-   Reduces database size and improves load time
-   Happens automatically with debounce (storeTimeout)

**Cross-Tab Synchronization**:

```typescript
// Enable in options
const persistence = new YjsIndexedDBPersistence('doc', doc, {
    broadcastChanges: true,
});

// How it works:
// 1. Tab A makes change → Saves to IndexedDB
// 2. Tab A broadcasts 'update' message via BroadcastChannel
// 3. Tab B receives message → Reloads from IndexedDB
// 4. Tab B applies updates → Documents stay in sync

// Channel name format: `yjs/${documentName}`
// Message format: { type: 'update', id: 'client-id' }
```

## Usage Examples

### Basic Document Persistence

```typescript
import { YjsIndexedDBPersistence } from '@casual-simulation/aux-common/yjs';
import * as Y from 'yjs';

// Create document
const doc = new Y.Doc();
const text = doc.getText('content');

// Set up persistence
const persistence = new YjsIndexedDBPersistence('my-doc', doc);

// Wait for initial load
await persistence.whenSynced;

// Make changes
text.insert(0, 'Hello');
text.insert(5, ', world!');

// Changes automatically saved to IndexedDB

// On page reload, data is automatically restored:
const doc2 = new Y.Doc();
const persistence2 = new YjsIndexedDBPersistence('my-doc', doc2);
await persistence2.whenSynced;

console.log(doc2.getText('content').toString());
// "Hello, world!"
```

### State Vector Operations

```typescript
import {
    getStateVector,
    createRelativePositionFromStateVector,
    createAbsolutePositionFromStateVector,
} from '@casual-simulation/aux-common/yjs';
import * as Y from 'yjs';

// Create document with some content
const doc = new Y.Doc();
const text = doc.getText('content');
text.insert(0, 'Hello, world!');

// Get current state
const stateVector = getStateVector(doc);
console.log('State:', stateVector);
// { '1234567': 13 } - Client 1234567 has 13 characters

// Create position at index 7 (after "Hello, ")
const relativePos = createRelativePositionFromStateVector(
    text,
    stateVector,
    7,
    0 // Associate to the right
);

// Later, convert back to absolute position
const absolutePos = createAbsolutePositionFromStateVector(
    doc,
    text,
    stateVector,
    7
);
console.log('Position:', absolutePos);
// { index: 7, assoc: 0 }

// Use for cursor positions, selections, etc.
```

### Tag Edits with Version Vectors

```typescript
import {
    createRelativePositionFromStateVector,
    createAbsolutePositionFromStateVector,
    getStateVector,
} from '@casual-simulation/aux-common/yjs';
import { preserve, insert, del } from '@casual-simulation/aux-common/bots';

// User A's document state
const docA = new Y.Doc();
const textA = docA.getText('description');
textA.insert(0, 'The quick brown fox');

// Capture state vector
const vectorA = getStateVector(docA);

// User B applies edit from version vector
const docB = new Y.Doc();
const textB = docB.getText('description');

// Apply A's content
textB.insert(0, 'The quick brown fox');

// Create edit at specific version
const editOps = [
    preserve(10), // Skip "The quick "
    insert('red '), // Insert "red "
    preserve(5), // Keep "brown"
    del(4), // Delete " fox"
];

// Convert to absolute positions using version vector
let currentIndex = 0;
for (const op of editOps) {
    if (op.type === 'preserve') {
        currentIndex += op.count;
    } else if (op.type === 'insert') {
        const absPos = createAbsolutePositionFromStateVector(
            docB,
            textB,
            vectorA,
            currentIndex
        );
        textB.insert(absPos.index, op.text);
        currentIndex += op.text.length;
    } else if (op.type === 'delete') {
        const absPos = createAbsolutePositionFromStateVector(
            docB,
            textB,
            vectorA,
            currentIndex
        );
        textB.delete(absPos.index, op.count);
    }
}

console.log(textB.toString());
// "The quick red brown"
```

### Cross-Tab Collaboration

```typescript
import { YjsIndexedDBPersistence } from '@casual-simulation/aux-common/yjs';
import * as Y from 'yjs';

// Tab 1: Enable broadcast
const doc1 = new Y.Doc();
const persistence1 = new YjsIndexedDBPersistence('shared-doc', doc1, {
    id: 'tab-1',
    broadcastChanges: true,
});
await persistence1.whenSynced;

// Tab 2: Also enable broadcast
const doc2 = new Y.Doc();
const persistence2 = new YjsIndexedDBPersistence('shared-doc', doc2, {
    id: 'tab-2',
    broadcastChanges: true,
});
await persistence2.whenSynced;

// Tab 1 makes change
const text1 = doc1.getText('content');
text1.insert(0, 'Hello from Tab 1');

// Tab 2 receives update automatically
// (via BroadcastChannel + IndexedDB reload)

// Wait a moment for sync
await new Promise((resolve) => setTimeout(resolve, 100));

const text2 = doc2.getText('content');
console.log(text2.toString());
// "Hello from Tab 1"

// Tab 2 makes change
text2.insert(17, ' and Tab 2');

// Tab 1 receives update
await new Promise((resolve) => setTimeout(resolve, 100));
console.log(text1.toString());
// "Hello from Tab 1 and Tab 2"
```

### Custom Metadata Storage

```typescript
import { YjsIndexedDBPersistence } from '@casual-simulation/aux-common/yjs';
import * as Y from 'yjs';

const doc = new Y.Doc();
const persistence = new YjsIndexedDBPersistence('project-doc', doc);
await persistence.whenSynced;

// Store metadata
await persistence.set('project-info', {
    name: 'My Project',
    author: 'Alice',
    created: Date.now(),
    version: '1.0.0',
});

await persistence.set('last-saved', Date.now());

// Store binary data
const avatar = new Uint8Array([1, 2, 3, 4]);
await persistence.set('avatar', avatar.buffer);

// Retrieve metadata
const projectInfo = await persistence.get('project-info');
console.log('Project:', projectInfo.name);

const lastSaved = await persistence.get('last-saved');
console.log('Last saved:', new Date(lastSaved));

// Delete metadata
await persistence.del('avatar');

// Metadata persists across sessions
// On reload:
const doc2 = new Y.Doc();
const persistence2 = new YjsIndexedDBPersistence('project-doc', doc2);
await persistence2.whenSynced;

const info = await persistence2.get('project-info');
console.log('Retrieved project:', info.name);
```

### Sync Status Indicators

```typescript
import { YjsIndexedDBPersistence } from '@casual-simulation/aux-common/yjs';
import * as Y from 'yjs';

const doc = new Y.Doc();
const persistence = new YjsIndexedDBPersistence('my-doc', doc);

// Show loading indicator
showSpinner();

// Subscribe to sync changes
persistence.onSyncChanged.subscribe((synced) => {
    if (synced) {
        hideSpinner();
        showMessage('Document loaded');
    } else {
        showSpinner();
        showMessage('Loading...');
    }
});

// Or use promise
await persistence.whenSynced;
hideSpinner();
showMessage('Ready to edit');

// Check current status
if (persistence.synced) {
    enableEditing();
} else {
    disableEditing();
}
```

### Performance Tuning

```typescript
import {
    YjsIndexedDBPersistence,
    PREFERRED_TRIM_SIZE,
} from '@casual-simulation/aux-common/yjs';
import * as Y from 'yjs';

const doc = new Y.Doc();
const persistence = new YjsIndexedDBPersistence('large-doc', doc);

// Adjust store timeout (default: 1000ms)
// Higher = less frequent saves, better performance
// Lower = more frequent saves, better durability
persistence.storeTimeout = 2000; // 2 seconds

// Monitor database size
console.log('Updates in DB:', persistence.dbsize);
console.log('Trim threshold:', PREFERRED_TRIM_SIZE); // 500

// Trimming happens automatically when dbsize >= 500
// Manual trimming not exposed (happens in background)

// For very large documents:
// - Trim threshold is hardcoded at 500 updates
// - Each trim compresses all updates into one
// - Reduces load time significantly
// - Trade-off: trimming takes time but reduces future load time
```

### Error Handling and Cleanup

```typescript
import {
    YjsIndexedDBPersistence,
    clearDocument,
} from '@casual-simulation/aux-common/yjs';
import * as Y from 'yjs';

try {
    const doc = new Y.Doc();
    const persistence = new YjsIndexedDBPersistence('my-doc', doc);

    // Wait with timeout
    await Promise.race([
        persistence.whenSynced,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Sync timeout')), 5000)
        ),
    ]);

    // Use document
    const text = doc.getText('content');
    text.insert(0, 'Hello');

    // Clean up when done
    await persistence.destroy();
} catch (error) {
    console.error('Persistence error:', error);

    // Handle QuotaExceededError
    if (error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded');
        // Clear old data or request more storage
    }
}

// Clear document data (e.g., for logout)
await clearDocument('my-doc');

// Or clear and destroy
const persistence = new YjsIndexedDBPersistence('temp-doc', doc);
await persistence.clearData(); // Destroys and deletes
```

### Character-Level Text Operations

```typescript
import { getTextChar } from '@casual-simulation/aux-common/yjs';
import * as Y from 'yjs';

const doc = new Y.Doc();
const text = doc.getText('content');
text.insert(0, 'Hello, world!');

// Get specific character
const char = getTextChar(text, 7);
console.log('Character at 7:', char); // 'w'

// Get first character
const first = getTextChar(text, 0);
console.log('First char:', first); // 'H'

// Get last character
const last = getTextChar(text, text.length - 1);
console.log('Last char:', last); // '!'

// Out of bounds
const invalid = getTextChar(text, 100);
console.log('Invalid:', invalid); // null

// Negative index
const negative = getTextChar(text, -1);
console.log('Negative:', negative); // null

// Use for validation, character inspection, etc.
function validateCharAt(
    text: Y.Text,
    index: number,
    expected: string
): boolean {
    const char = getTextChar(text, index);
    return char === expected;
}
```

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Yjs Module                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │          YjsIndexedDBPersistence               │    │
│  │                                                │    │
│  │  • Automatic persistence to IndexedDB          │    │
│  │  • Update history compression                  │    │
│  │  • Cross-tab synchronization                   │    │
│  │  • Custom key-value storage                    │    │
│  │  • Observable sync status                      │    │
│  │                                                │    │
│  │  Database Structure:                           │    │
│  │  ┌──────────────────────────────────┐         │    │
│  │  │ updates (auto-increment)         │         │    │
│  │  │  - Yjs binary updates            │         │    │
│  │  │  - Auto-trimmed at 500 updates   │         │    │
│  │  └──────────────────────────────────┘         │    │
│  │  ┌──────────────────────────────────┐         │    │
│  │  │ custom (key-value)               │         │    │
│  │  │  - User metadata                 │         │    │
│  │  │  - Timestamps, configs, etc.     │         │    │
│  │  └──────────────────────────────────┘         │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │            YjsHelpers                          │    │
│  │                                                │    │
│  │  • getStateVector() - Version vectors          │    │
│  │  • getClock() - Client clock values            │    │
│  │  • createRelativePosition*() - CRDT positions  │    │
│  │  • createAbsolutePosition*() - Index positions │    │
│  │  • getTextChar() - Character access            │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴────────────────┐
        │                                │
┌───────▼──────────┐         ┌──────────▼──────────┐
│  YjsPartition    │         │  RemoteYjsPartition │
│                  │         │                     │
│  • Local CRDT    │         │  • Networked CRDT   │
│  • IndexedDB     │         │  • Server sync      │
│  • Offline-first │         │  • Multi-user       │
└──────────────────┘         └─────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              Persistence Flow Diagram                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Application                                             │
│      │                                                   │
│      │ doc.getText().insert(0, 'Hello')                 │
│      │                                                   │
│      ▼                                                   │
│  Yjs Document                                            │
│      │                                                   │
│      │ emit 'update' event                              │
│      │                                                   │
│      ▼                                                   │
│  YjsIndexedDBPersistence                                 │
│      │                                                   │
│      ├─► Store update to IndexedDB                      │
│      │   (debounced by storeTimeout)                    │
│      │                                                   │
│      ├─► Increment dbsize counter                       │
│      │                                                   │
│      ├─► Check if dbsize >= 500                         │
│      │   ├─► YES: Trim database                         │
│      │   │   ├─► Encode full document state            │
│      │   │   ├─► Store as single update                │
│      │   │   └─► Delete old updates                    │
│      │   └─► NO: Continue                               │
│      │                                                   │
│      └─► Broadcast 'update' via BroadcastChannel        │
│                                                          │
│  Other Tabs (if broadcastChanges enabled)               │
│      │                                                   │
│      │ Receive 'update' message                         │
│      │                                                   │
│      ▼                                                   │
│  Reload from IndexedDB                                   │
│      │                                                   │
│      └─► Apply updates to local doc                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Key Concepts

### Version Vectors (State Vectors)

**Purpose**: Track document state at specific point in time

**Format**:

```typescript
interface VersionVector {
    [clientId: string]: number;  // Next expected clock for this client
}

// Example:
{
    '123': 10,  // Client 123 has made 10 updates
    '456': 5,   // Client 456 has made 5 updates
    '789': 0    // Client 789 has made 0 updates
}
```

**Usage**:

-   Synchronization: Determine what updates are needed
-   Conflict detection: Check if documents are in sync
-   Operational transforms: Apply edits at specific versions
-   Tag edits: Convert between relative and absolute positions

### Relative vs Absolute Positions

**Absolute Position**:

-   Index in character array: `{ index: 10 }`
-   Changes when content before it is edited
-   Simple but not CRDT-safe

**Relative Position**:

-   Position relative to document structure
-   Based on Yjs item IDs (client + clock)
-   Stable across concurrent edits
-   CRDT-safe and convergent

**Conversion**:

```typescript
// Absolute → Relative (for storage)
const relPos = createRelativePositionFromStateVector(text, stateVector, 10);

// Relative → Absolute (for display)
const absPos = createAbsolutePositionFromStateVector(
    doc,
    text,
    stateVector,
    10
);
```

### Update Trimming

**Problem**: Yjs stores every single update, database grows large

**Solution**: Periodic trimming

1. When `dbsize >= 500` updates
2. Encode entire document as single update
3. Delete all previous updates
4. Reduces database size by ~99%

**Trade-offs**:

-   **Pro**: Much smaller database, faster load times
-   **Pro**: No data loss (full document state preserved)
-   **Con**: Trimming operation takes time
-   **Con**: Loses detailed history (if needed for undo/redo)

**Control**:

-   Threshold: `PREFERRED_TRIM_SIZE = 500` (hardcoded)
-   Debounce: `storeTimeout` (default 1000ms, adjustable)
-   Automatic: Happens in background, no manual trigger

### Cross-Tab Synchronization

**Mechanism**: BroadcastChannel API

**Flow**:

1. Tab A makes change → Saves to IndexedDB
2. Tab A posts message to BroadcastChannel: `yjs/${docName}`
3. Tab B receives message
4. Tab B reloads from IndexedDB
5. Tab B applies updates
6. Documents converge

**Limitations**:

-   Same origin only (same domain)
-   Not supported in some browsers (fallback: manual reload)
-   Slight delay (usually <100ms)

**Enable**:

```typescript
new YjsIndexedDBPersistence('doc', doc, {
    broadcastChanges: true,
});
```

### IndexedDB Structure

**Database Name**: Document name (e.g., 'my-document')

**Object Stores**:

1. **updates** (auto-increment keys):
    - Stores Yjs binary updates (Uint8Array)
    - Keys: 1, 2, 3, ... (sequential)
    - Trimmed when count >= 500
2. **custom** (user keys):
    - Stores arbitrary key-value data
    - Keys: string, number, ArrayBuffer, Date
    - Values: Any JSON-serializable data
    - Independent of Yjs updates

**Storage Quota**:

-   Browser-dependent (typically 50% of available disk)
-   QuotaExceededError if exceeded
-   Clear old documents or request persistent storage

## Dependencies

The yjs module depends on:

-   **Yjs**: CRDT library for collaborative editing
-   **lib0/indexeddb**: IndexedDB utilities from Yjs ecosystem
-   **RxJS**: Observable streams for sync status
-   **uuid**: Generate unique client IDs
-   `@casual-simulation/aux-common/common`: VersionVector type

## Integration Points

The yjs module integrates with:

-   **YjsPartition**: Uses YjsIndexedDBPersistence for local storage
-   **RemoteYjsPartition**: Uses YjsHelpers for state vector operations
-   **PartitionUtils**: Uses YjsHelpers for tag edit operations
-   **documents/**: Shared document abstractions use Yjs helpers

## Testing

The module includes comprehensive test files:

-   **YjsHelpers.spec.ts**: Helper function tests (state vectors, positions, character access)
-   **YjsIndexedDBPersistence.spec.ts**: Persistence tests (storage, trimming, cross-tab sync)

## Related Packages

-   **yjs**: Core CRDT library (external dependency)
-   **lib0**: Yjs ecosystem utilities (external dependency)
-   `@casual-simulation/aux-common/partitions`: Partition implementations using Yjs
-   `@casual-simulation/aux-common/documents`: Document abstractions
-   `@casual-simulation/aux-common/bots`: Tag edit operations
