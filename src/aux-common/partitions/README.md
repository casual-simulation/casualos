# Partitions

Data storage and synchronization layer for CasualOS. This folder contains partition implementations that manage bot state across different storage backends, networking protocols, and collaboration scenarios.

## Overview

Partitions are pluggable storage backends that handle:

-   **Bot State Management**: Adding, removing, and updating bots
-   **Real-time Synchronization**: Multi-user collaborative editing with CRDTs (Yjs)
-   **Persistence**: Memory, local storage, remote databases
-   **Event Distribution**: Broadcasting bot actions and state changes
-   **Conflict Resolution**: Handling concurrent edits from multiple users
-   **Version Tracking**: Monitoring state versions and update vectors

Each partition implements the `AuxPartitionBase` interface and provides observables for state changes, allowing the CasualOS runtime to react to data updates regardless of the underlying storage mechanism.

## Main Exports

### AuxPartition (`AuxPartition.ts`)

Core partition interfaces and types (326 lines):

```typescript
import type {
    AuxPartition,
    AuxPartitions,
    AuxPartitionRealtimeStrategy,
} from '@casual-simulation/aux-common/partitions';

// Partition collection
interface AuxPartitions {
    shared: AuxPartition;
    [key: string]: AuxPartition;
}

// Union type of all partition implementations
type AuxPartition =
    | MemoryPartition
    | CausalRepoPartition
    | RemoteCausalRepoPartition
    | LocalStoragePartition
    | ProxyClientPartition
    | BotPartition
    | OtherPlayersPartition
    | YjsPartition;

// Edit strategies
type AuxPartitionRealtimeStrategy = 'immediate' | 'delayed';
```

**Base Interface** (`AuxPartitionBase`):

```typescript
interface AuxPartitionBase {
    // Configuration
    private: boolean; // Exclude from exports
    space: string; // Bot space (e.g., "shared", "tempShared")
    realtimeStrategy: AuxPartitionRealtimeStrategy;

    // Core methods
    applyEvents(events: BotAction[]): Promise<BotAction[]>;
    sendRemoteEvents?(events: RemoteActions[]): Promise<void>;
    connect(): void;
    enableCollaboration?(): Promise<void>;

    // Observables
    onBotsAdded: Observable<Bot[]>;
    onBotsRemoved: Observable<string[]>;
    onBotsUpdated: Observable<UpdatedBot[]>;
    onStateUpdated: Observable<StateUpdatedEvent>;
    onVersionUpdated: Observable<CurrentVersion>;
    onError: Observable<any>;
    onEvents: Observable<Action[]>;
    onStatusUpdated: Observable<StatusUpdate>;
}
```

**Partition Types**:

-   `MemoryPartition`: In-memory storage (fast, non-persistent)
-   `YjsPartition`: Local Yjs CRDT storage with optional persistence
-   `RemoteCausalRepoPartition`: Networked Yjs with server sync
-   `OtherPlayersPartition`: Multi-user player state aggregation
-   `LocalStoragePartition`: Browser local storage
-   `ProxyClientPartition`: Cross-thread partition proxy
-   `ProxyBridgePartition`: Observable bridge for proxied partitions
-   `BotPartition`: Query-based bot storage
-   `CausalRepoPartition`: Causal tree-based storage

**Utility Functions**:

```typescript
// Get state from partition
function getPartitionState(partition: AuxPartition): BotsState;

// Iterate partitions in priority order
function* iteratePartitions<T>(partitions: T): Generator<[key, value]>;
```

### AuxPartitionConfig (`AuxPartitionConfig.ts`)

Configuration types for creating partitions (439 lines):

```typescript
import type {
    AuxPartitionConfig,
    PartitionConfig,
} from '@casual-simulation/aux-common/partitions';

// Top-level configuration
interface AuxPartitionConfig {
    shared: PartitionConfig;
    [key: string]: PartitionConfig;
}

// Union of all partition configs
type PartitionConfig =
    | MemoryPartitionStateConfig
    | MemoryPartitionInstanceConfig
    | ProxyPartitionConfig
    | ProxyClientPartitionConfig
    | LocalStoragePartitionConfig
    | OtherPlayersClientPartitionConfig
    | OtherPlayersRepoPartitionConfig
    | YjsPartitionConfig
    | RemoteYjsPartitionConfig
    | YjsClientPartitionConfig
    | InjectedPartitionConfig;
```

**Memory Partition Config**:

```typescript
// With initial state
interface MemoryPartitionStateConfig {
    type: 'memory';
    initialState: BotsState;
    localSiteId?: string;
    remoteSiteId?: string;
    private?: boolean;
}

// With existing partition instance
interface MemoryPartitionInstanceConfig {
    type: 'memory';
    partition?: MemoryPartition;
    private?: boolean;
}
```

**Yjs Partition Config**:

```typescript
interface YjsPartitionConfig {
    type: 'yjs';
    branch?: string; // For persistence
    localPersistence?: {
        saveToIndexedDb: boolean;
        encryptionKey?: string;
    };
    remoteEvents?: PartitionRemoteEvents | boolean;
    connectionId?: string;
    private?: boolean;
}
```

**Remote Yjs Partition Config**:

```typescript
interface RemoteYjsPartitionConfig {
    type: 'yjs_client';
    client: InstRecordsClient;
    recordName: string | null;
    inst: string;
    branch: string;
    temporary?: boolean;
    remoteEvents?: PartitionRemoteEvents | boolean;
    private?: boolean;
}
```

**Other Players Partition Config**:

```typescript
interface OtherPlayersClientPartitionConfig {
    type: 'other_players_client';
    recordName: string | null;
    inst: string;
    branch: string;
    client: InstRecordsClient;
    childPartitionType?: 'yjs_client';
    skipInitialLoad?: boolean;
    private?: boolean;
}
```

**Proxy Partition Config**:

```typescript
interface ProxyPartitionConfig {
    type: 'proxy';
    partition: AuxPartition;
    private?: boolean;
}

interface ProxyClientPartitionConfig {
    type: 'proxy_client';
    editStrategy: AuxPartitionRealtimeStrategy;
    port: MessagePort;
    private?: boolean;
}
```

**Local Storage Partition Config**:

```typescript
interface LocalStoragePartitionConfig {
    type: 'local_storage';
    namespace: string;
    private?: boolean;
}
```

**Injected Partition Config**:

```typescript
interface InjectedPartitionConfig {
    type: 'injected';
    partition: AuxPartition;
    private?: boolean;
}
```

**Remote Events Configuration**:

```typescript
interface PartitionRemoteEvents {
    [key: string]: boolean; // Event type -> enabled
    remoteActions?: boolean; // Default for all
}
```

### MemoryPartition (`MemoryPartition.ts`)

In-memory partition implementation (464 lines):

```typescript
import {
    createMemoryPartition,
    MemoryPartitionImpl,
} from '@casual-simulation/aux-common/partitions';

// Create memory partition
const partition = createMemoryPartition({
    type: 'memory',
    initialState: {
        bot1: { id: 'bot1', tags: { name: 'Test Bot' } },
    },
    localSiteId: 'user1',
    remoteSiteId: 'server1',
    private: false,
});

// Apply events
const results = await partition.applyEvents([
    botAdded(createBot('bot2', { name: 'New Bot' })),
    botUpdated('bot1', { tags: { name: 'Updated Bot' } }),
]);

// Subscribe to changes
partition.onBotsAdded.subscribe((bots) => {
    console.log('Bots added:', bots);
});

partition.onBotsUpdated.subscribe((updates) => {
    console.log('Bots updated:', updates);
});

partition.onBotsRemoved.subscribe((ids) => {
    console.log('Bots removed:', ids);
});

// Access current state
const state = partition.state;
console.log('Current bots:', Object.keys(state));
```

**Key Features**:

-   **Immediate Strategy**: Changes apply instantly (`realtimeStrategy = 'immediate'`)
-   **Event Processing**: Handles add, remove, update, tag edit operations
-   **Version Tracking**: Maintains site IDs and version vectors
-   **Tag Edits**: Supports granular text editing with operational transforms
-   **State Updates**: Emits `StateUpdatedEvent` with full or partial state
-   **Serialization**: Ensures bots and tags are JSON-serializable

**Supported Events**:

-   `AddBotAction`: Add new bot
-   `RemoveBotAction`: Remove bot
-   `UpdateBotAction`: Update bot tags
-   `TagEdit`: Granular tag text edits (insert, delete, preserve)

### YjsPartition (`YjsPartition.ts`)

Local Yjs CRDT partition with optional persistence (860 lines):

```typescript
import {
    createYjsPartition,
    YjsPartitionImpl,
} from '@casual-simulation/aux-common/partitions';

// Create local Yjs partition
const partition = createYjsPartition({
    type: 'yjs',
    branch: 'my-branch',
    localPersistence: {
        saveToIndexedDb: true,
        encryptionKey: 'optional-encryption-key',
    },
    remoteEvents: {
        onRemoteWhisper: true,
        onRemoteData: true,
        remoteActions: false,
    },
    connectionId: 'conn123',
});

// Connect and sync
partition.connect();

// Apply bot actions
await partition.applyEvents([
    botAdded(createBot('bot1', { name: 'CRDT Bot' })),
]);

// Handle inst updates (for sync)
partition.onInstUpdate.subscribe((update) => {
    console.log('Update to sync:', update.update);
});

// Apply remote updates
await partition.applyEvents([
    {
        type: 'apply_updates_to_inst',
        updates: [encodedUpdate],
        taskId: 'task1',
    },
]);

// Get current state as update
await partition.applyEvents([
    {
        type: 'get_current_inst_update',
        taskId: 'task2',
    },
]);
```

**Key Features**:

-   **Yjs CRDT**: Uses Yjs for conflict-free collaborative editing
-   **Local Persistence**: Saves to IndexedDB with optional encryption
-   **Update Protocol**: Emits binary updates for synchronization
-   **Tag Edits**: Converts CasualOS tag edits to Yjs operations
-   **Remote Events**: Configurable support for remote actions
-   **Initialization**: Can create initialization updates for new clients

**Special Actions**:

-   `ApplyUpdatesToInstAction`: Apply Yjs updates from network
-   `GetCurrentInstUpdateAction`: Get current state as update
-   `CreateInitializationUpdateAction`: Create init update for new clients
-   `GetInstStateFromUpdatesAction`: Decode state from updates
-   `InstallAuxAction`: Install aux from updates

**Yjs Integration**:

-   **Doc**: Yjs document containing bots and masks
-   **Maps**: Nested Yjs Maps for bot tags
-   **Text**: Yjs Text for string tag values
-   **Transactions**: Batched updates with origin tracking

### RemoteYjsPartition (`RemoteYjsPartition.ts`)

Networked Yjs partition with server synchronization (1000 lines):

```typescript
import { createRemoteClientYjsPartition } from '@casual-simulation/aux-common/partitions';

// Create with InstRecordsClient
const partition = await createRemoteClientYjsPartition(
    {
        type: 'yjs_client',
        client: instRecordsClient,
        recordName: 'myRecord',
        inst: 'myInst',
        branch: 'main',
        temporary: false,
        remoteEvents: true,
    },
    authSource
);

// Connect to server
partition.connect();

// Subscribe to connection status
partition.onConnectionStateChanged.subscribe((state) => {
    console.log('Connection:', state.connected ? 'online' : 'offline');
});

// Handle remote events
partition.onRemoteEvents.subscribe((events) => {
    console.log('Remote events:', events);
});

// Send remote events
await partition.sendRemoteEvents([
    {
        type: 'remote',
        event: shout('onPlayerJoined', { player: 'user1' }),
    },
]);

// Get remote count
await partition.applyEvents([
    {
        type: 'get_remote_count',
        taskId: 'task1',
    },
]);

// List updates
await partition.applyEvents([
    {
        type: 'list_inst_updates',
        recordName: 'myRecord',
        inst: 'myInst',
        branch: 'main',
        taskId: 'task2',
    },
]);
```

**Key Features**:

-   **Server Sync**: Connects to InstRecordsClient for multi-user sync
-   **Connection Management**: Automatic reconnection and offline support
-   **Remote Events**: Send/receive shouts, whispers, and data events
-   **Branch Management**: Supports record/inst/branch hierarchy
-   **Rate Limiting**: Handles size limits and rate limit errors
-   **Authentication**: Integrates with PartitionAuthSource
-   **Temporary Spaces**: Supports temporary collaboration spaces

**Network Actions**:

-   `GetRemoteCountAction`: Get connected user count
-   `ListInstUpdatesAction`: List available updates
-   Remote shouts, whispers, and data actions

**Connection States**:

-   **Connected**: Actively syncing with server
-   **Disconnected**: Offline, queuing updates
-   **Synced**: Fully synchronized with server

**Error Handling**:

-   `ON_SPACE_MAX_SIZE_REACHED`: Space storage limit exceeded
-   `ON_SPACE_RATE_LIMIT_EXCEEDED`: Rate limit triggered
-   Auth errors: Permission denied, not authorized

### OtherPlayersPartition (`OtherPlayersPartition.ts`)

Multi-user player state aggregation (597 lines):

```typescript
import { createOtherPlayersClientPartition } from '@casual-simulation/aux-common/partitions';

// Create other players partition
const partition = await createOtherPlayersClientPartition(
    {
        type: 'other_players_client',
        recordName: 'myRecord',
        inst: 'myInst',
        branch: 'players',
        client: instRecordsClient,
        childPartitionType: 'yjs_client',
        skipInitialLoad: false,
    },
    authSource
);

partition.space = 'otherPlayers';
partition.connect();

// Subscribe to player events
partition.onBotsAdded.subscribe((bots) => {
    console.log('Players joined:', bots);
});

partition.onBotsRemoved.subscribe((ids) => {
    console.log('Players left:', ids);
});

// Access aggregated player state
const allPlayers = partition.state;
console.log('Current players:', Object.keys(allPlayers));

// Get remotes (connected players)
await partition.applyEvents([
    {
        type: 'get_remotes',
        taskId: 'task1',
    },
]);
```

**Key Features**:

-   **Dynamic Loading**: Automatically creates partitions for each connected player
-   **Player Discovery**: Watches branch for player connections/disconnections
-   **State Aggregation**: Merges state from all player partitions
-   **Child Partitions**: Creates Yjs partitions for each player
-   **Event Forwarding**: Emits events for player join/leave
-   **Connection Tracking**: Maps session IDs to connection info

**Player Events**:

-   `ON_REMOTE_PLAYER_SUBSCRIBED`: Player subscription started
-   `ON_REMOTE_PLAYER_UNSUBSCRIBED`: Player subscription ended
-   `ON_REMOTE_JOINED`: Player connection established
-   `ON_REMOTE_LEAVE`: Player disconnected

**Architecture**:

-   **Main Partition**: Watches for player list changes
-   **Child Partitions**: One per connected player (Yjs partitions)
-   **Subscriptions**: Manages lifecycle of child partition subscriptions
-   **Branch Structure**: Players organized by branch/session

### ProxyBridgePartition (`ProxyBridgePartition.ts`)

Observable bridge for cross-thread partitions (171 lines):

```typescript
import { ProxyBridgePartitionImpl } from '@casual-simulation/aux-common/partitions';

// Create bridge wrapper
const bridge = new ProxyBridgePartitionImpl(underlyingPartition);

// Set up listeners
await bridge.addListeners(
    (bots) => console.log('Bots added:', bots),
    (ids) => console.log('Bots removed:', ids),
    (updates) => console.log('Bots updated:', updates),
    (state) => console.log('State updated:', state),
    (error) => console.error('Error:', error),
    (actions) => console.log('Events:', actions),
    (status) => console.log('Status:', status),
    (version) => console.log('Version:', version)
);

// Forward events
await bridge.applyEvents([botAdded(createBot('bot1', { name: 'Test' }))]);

// Forward remote events
await bridge.sendRemoteEvents([{ type: 'remote', event: shout('test') }]);

// Set space
await bridge.setSpace('shared');

// Clean up
bridge.unsubscribe();
```

**Key Features**:

-   **Observable Forwarding**: Bridges all partition observables
-   **Cross-Thread**: Enables partition use across thread boundaries
-   **Listener Management**: Async listener setup
-   **Event Proxying**: Forwards all partition operations
-   **Space Management**: Async space setting

### PartitionAuthSource (`PartitionAuthSource.ts`)

Authentication event coordination for partitions (428 lines):

```typescript
import { PartitionAuthSource } from '@casual-simulation/aux-common/partitions';

// Create auth source
const authSource = new PartitionAuthSource();

// Listen for auth requests
authSource.onAuthRequest.subscribe(async (request) => {
    console.log('Auth requested for:', request.recordName, request.inst);

    // Provide auth
    authSource.respondToAuthRequest(request.id, {
        success: true,
        connectionKey: 'auth-token-123',
        publicRecordKey: 'public-key',
        subjectfull: { id: 'user1', username: 'alice' },
    });
});

// Listen for permission requests
authSource.onAuthPermissionRequest.subscribe(async (request) => {
    console.log('Permission requested:', request.action, request.resourceKind);

    // Grant permission
    authSource.respondToPermissionRequest(request.id, {
        success: true,
    });
});

// Listen for external permission requests
authSource.onAuthExternalPermissionRequest.subscribe((request) => {
    console.log('External permission:', request);
});

// Request auth
const authResult = await authSource.requestAuthData(
    'myRecord',
    'myInst',
    'main'
);

// Request permission
const permResult = await authSource.requestPermission(
    'read',
    'inst',
    { recordName: 'myRecord', inst: 'myInst' },
    [{ resourceKind: 'inst', action: 'read', subjectType: 'user' }]
);

// Update connection indicator
authSource.setConnectionIndicator('partition1', {
    connected: true,
    connectionId: 'conn123',
    info: { user: 'alice' },
});
```

**Key Features**:

-   **Request/Response**: Async auth request handling
-   **Permission Management**: Resource-based permissions
-   **External Permissions**: Cross-partition permission requests
-   **Connection Tracking**: Monitor partition connection states
-   **Promise-based**: Returns promises for auth results

**Message Types**:

-   `PartitionAuthRequest`: Request auth for record/inst/branch
-   `PartitionAuthResponse`: Provide auth credentials
-   `PartitionAuthRequestPermission`: Request permission for action
-   `PartitionAuthPermissionResult`: Permission grant/denial
-   `PartitionAuthExternalRequestPermission`: External permission request
-   `PartitionAuthExternalPermissionResult`: External permission result

**Auth Data**:

```typescript
interface AuthData {
    success: boolean;
    connectionKey?: string;
    publicRecordKey?: string | null;
    subjectfull?: PublicUserInfo;
    errorCode?: string;
    errorMessage?: string;
}
```

### PartitionUtils (`PartitionUtils.ts`)

Utility functions for partition operations (354 lines):

```typescript
import {
    constructInitializationUpdate,
    getStateFromUpdates,
    mergeInstUpdates,
    ensureBotIsSerializable,
    ensureTagIsSerializable,
    supportsRemoteEvent,
} from '@casual-simulation/aux-common/partitions';

// Create initialization update
const initUpdate = constructInitializationUpdate({
    type: 'create_initialization_update',
    bots: [
        { id: 'bot1', tags: { name: 'Bot 1' } },
        { id: 'bot2', tags: { name: 'Bot 2' } },
    ],
    taskId: 'task1',
});

// Get state from updates
const state = getStateFromUpdates({
    type: 'get_inst_state_from_updates',
    updates: [update1, update2, update3],
    taskId: 'task2',
});

// Merge multiple updates
const merged = mergeInstUpdates(
    [update1, update2, update3],
    4, // New ID
    Date.now() // Timestamp
);

// Ensure bot is serializable
const serialized = ensureBotIsSerializable({
    id: 'bot1',
    tags: {
        position: new Vector3(1, 2, 3),
        rotation: new Rotation({ axis: UP, angle: Math.PI / 2 }),
        date: DateTime.now(),
    },
});
// Result: { id: 'bot1', tags: { position: {x:1,y:2,z:3}, rotation: {...}, date: "..." } }

// Ensure tag is serializable
const tag = ensureTagIsSerializable(new Vector2(5, 10));
// Result: { x: 5, y: 10 }

// Check remote event support
const supports = supportsRemoteEvent('onRemoteWhisper', {
    onRemoteWhisper: true,
    remoteActions: false,
});
// Result: true
```

**Key Functions**:

-   `constructInitializationUpdate()`: Create Yjs update from bot list
-   `getStateFromUpdates()`: Decode bot state from Yjs updates
-   `mergeInstUpdates()`: Combine multiple updates into one
-   `ensureBotIsSerializable()`: Convert bot with special types to JSON
-   `ensureTagIsSerializable()`: Convert tag value to JSON (Vector2/3, Rotation, DateTime)
-   `supportsRemoteEvent()`: Check if partition supports remote event type

**Serialization Support**:

-   `Vector2`, `Vector3`: Convert to `{x, y, z?}` objects
-   `Rotation`: Convert to serializable rotation object
-   `DateTime` (Luxon): Format as ISO string
-   `Bot` with `ORIGINAL_OBJECT`: Preserve original reference

### AuxPartitionFactories (`AuxPartitionFactories.ts`)

Factory pattern for creating partitions (58 lines):

```typescript
import {
    createAuxPartition,
    type AuxPartitionFactory,
} from '@casual-simulation/aux-common/partitions';

// Define custom factory
const myFactory: AuxPartitionFactory = (config, services) => {
    if (config.type === 'my_custom_type') {
        return new MyCustomPartition(config);
    }
    return undefined;
};

// Create partition with factory chain
const partition = await createAuxPartition(
    {
        type: 'memory',
        initialState: {},
    },
    {
        authSource: myAuthSource,
    },
    myFactory,
    defaultFactory1,
    defaultFactory2
);

// Factory services
interface AuxPartitionServices {
    authSource: PartitionAuthSource;
}

// Factory function signature
type AuxPartitionFactory = (
    config: PartitionConfig,
    services: AuxPartitionServices
) => Promise<AuxPartition> | AuxPartition;
```

**Key Features**:

-   **Factory Chain**: Try factories in order until one succeeds
-   **Injected Partitions**: Handle pre-built partition instances
-   **Service Injection**: Provide auth source to factories
-   **Async Support**: Factories can return promises
-   **Undefined Handling**: Return undefined if factory doesn't match config type

## Usage Examples

### Basic Memory Partition

```typescript
import { createMemoryPartition } from '@casual-simulation/aux-common/partitions';
import {
    botAdded,
    createBot,
    botUpdated,
} from '@casual-simulation/aux-common/bots';

// Create partition
const partition = createMemoryPartition({
    type: 'memory',
    initialState: {},
    private: false,
});

// Subscribe to changes
partition.onBotsAdded.subscribe((bots) => {
    bots.forEach((bot) => console.log(`Added: ${bot.id}`));
});

partition.onBotsUpdated.subscribe((updates) => {
    updates.forEach((u) => console.log(`Updated: ${u.bot.id}`));
});

// Add bots
await partition.applyEvents([
    botAdded(
        createBot('player1', {
            name: 'Alice',
            position: { x: 0, y: 0, z: 0 },
        })
    ),
    botAdded(
        createBot('player2', {
            name: 'Bob',
            position: { x: 5, y: 5, z: 0 },
        })
    ),
]);

// Update bot
await partition.applyEvents([
    botUpdated('player1', {
        tags: { position: { x: 1, y: 1, z: 0 } },
    }),
]);

// Access state
const state = partition.state;
console.log('Total bots:', Object.keys(state).length);
```

### Local Yjs with Persistence

```typescript
import { createYjsPartition } from '@casual-simulation/aux-common/partitions';

// Create with local persistence
const partition = createYjsPartition({
    type: 'yjs',
    branch: 'my-workspace',
    localPersistence: {
        saveToIndexedDb: true,
        encryptionKey: 'secret-key-123',
    },
});

partition.connect();

// Add bot
await partition.applyEvents([botAdded(createBot('bot1', { type: 'cube' }))]);

// Get current state as update (for sharing)
const result = await partition.applyEvents([
    {
        type: 'get_current_inst_update',
        taskId: 'get-update',
    },
]);
// result contains asyncResult with update data

// Create initialization update for new client
const initResult = await partition.applyEvents([
    {
        type: 'create_initialization_update',
        bots: Object.values(partition.state),
        taskId: 'create-init',
    },
]);
```

### Remote Collaboration with Server

```typescript
import { createRemoteClientYjsPartition } from '@casual-simulation/aux-common/partitions';
import { PartitionAuthSource } from '@casual-simulation/aux-common/partitions';

// Set up auth
const authSource = new PartitionAuthSource();
authSource.onAuthRequest.subscribe((request) => {
    authSource.respondToAuthRequest(request.id, {
        success: true,
        connectionKey: 'my-auth-token',
    });
});

// Create remote partition
const partition = await createRemoteClientYjsPartition(
    {
        type: 'yjs_client',
        client: myInstRecordsClient,
        recordName: 'project',
        inst: 'workspace',
        branch: 'main',
        remoteEvents: {
            onRemoteWhisper: true,
            onRemoteData: true,
        },
    },
    authSource
);

partition.connect();

// Monitor connection
partition.onConnectionStateChanged.subscribe((state) => {
    if (state.connected) {
        console.log('Connected to server');
    } else {
        console.log('Disconnected from server');
    }
});

// Send remote event
await partition.sendRemoteEvents([
    {
        type: 'remote',
        event: {
            type: 'action',
            event: {
                type: 'show_toast',
                message: 'Hello from remote!',
            },
        },
    },
]);

// Get connected user count
await partition.applyEvents([
    {
        type: 'get_remote_count',
        taskId: 'count-users',
    },
]);
```

### Multi-User Player Tracking

```typescript
import { createOtherPlayersClientPartition } from '@casual-simulation/aux-common/partitions';

// Create players partition
const playersPartition = await createOtherPlayersClientPartition(
    {
        type: 'other_players_client',
        recordName: 'game',
        inst: 'session1',
        branch: 'players',
        client: instRecordsClient,
    },
    authSource
);

playersPartition.space = 'otherPlayers';
playersPartition.connect();

// Listen for players joining
playersPartition.onBotsAdded.subscribe((players) => {
    players.forEach((player) => {
        console.log(`Player ${player.tags.username} joined`);
    });
});

// Listen for players leaving
playersPartition.onBotsRemoved.subscribe((ids) => {
    ids.forEach((id) => {
        console.log(`Player ${id} left`);
    });
});

// Get list of current players
const currentPlayers = playersPartition.state;
console.log(`${Object.keys(currentPlayers).length} players online`);

// Get detailed remote info
const result = await playersPartition.applyEvents([
    {
        type: 'get_remotes',
        taskId: 'get-players',
    },
]);
```

### Cross-Thread Partition Proxy

```typescript
import { ProxyBridgePartitionImpl } from '@casual-simulation/aux-common/partitions';

// In main thread
const mainPartition = createMemoryPartition({
    type: 'memory',
    initialState: {},
});

const bridge = new ProxyBridgePartitionImpl(mainPartition);

// Set up message port communication
const { port1, port2 } = new MessageChannel();

// Listen for events and forward to worker
await bridge.addListeners(
    (bots) => port1.postMessage({ type: 'bots_added', bots }),
    (ids) => port1.postMessage({ type: 'bots_removed', ids }),
    (updates) => port1.postMessage({ type: 'bots_updated', updates }),
    (state) => port1.postMessage({ type: 'state_updated', state })
);

// In worker thread
port2.onmessage = (event) => {
    switch (event.data.type) {
        case 'bots_added':
            console.log('Bots added in main:', event.data.bots);
            break;
        case 'bots_updated':
            console.log('Bots updated in main:', event.data.updates);
            break;
    }
};
```

### Tag Edits with Operational Transforms

```typescript
import { preserve, insert, del } from '@casual-simulation/aux-common/bots';

// Granular text editing
await partition.applyEvents([
    {
        type: 'update_bot',
        id: 'bot1',
        update: {
            tags: {
                description: edit(
                    {}, // No version initially
                    preserve(5), // Keep first 5 chars
                    insert('HELLO '), // Insert text
                    preserve(10), // Keep next 10 chars
                    del(3) // Delete 3 chars
                ),
            },
        },
    },
]);

// Version tracking
const tagEdit = edit(
    { [currentSite]: 5 }, // Current version vector
    preserve(10),
    insert('New text')
);
```

### Custom Partition Factory

```typescript
import {
    createAuxPartition,
    type AuxPartitionFactory,
} from '@casual-simulation/aux-common/partitions';

// Custom partition implementation
class CustomPartition implements MemoryPartition {
    type = 'memory' as const;
    // ... implement interface
}

// Custom factory
const customFactory: AuxPartitionFactory = (config, services) => {
    if (config.type === 'memory' && config.namespace === 'custom') {
        return new CustomPartition(config);
    }
    return undefined;
};

// Use in creation
const partition = await createAuxPartition(
    { type: 'memory', namespace: 'custom', initialState: {} },
    { authSource: myAuthSource },
    customFactory,
    createMemoryPartition,
    createYjsPartition
);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AUX Runtime / Engine                     │
├─────────────────────────────────────────────────────────────┤
│  Applies bot actions, manages partitions, handles events    │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┬─────────────────────┐
        │                           │                     │
┌───────▼──────────┐    ┌──────────▼──────────┐   ┌─────▼──────────┐
│  MemoryPartition │    │   YjsPartition      │   │ OtherPlayers   │
│                  │    │                     │   │  Partition     │
│ - In-memory      │    │ - Yjs CRDT          │   │                │
│ - Fast/volatile  │    │ - Local IndexedDB   │   │ - Multi-user   │
│ - Immediate      │    │ - Optional encrypt  │   │ - Dynamic load │
└──────────────────┘    └──────────┬──────────┘   └────┬───────────┘
                                   │                   │
                       ┌───────────▼───────────────────▼──────────┐
                       │      RemoteYjsPartition                  │
                       │                                          │
                       │ - Server sync via InstRecordsClient      │
                       │ - Websocket/HTTPS protocol               │
                       │ - Multi-user collaboration               │
                       │ - Remote events (shouts/whispers)        │
                       │ - Connection management                  │
                       └──────────────┬───────────────────────────┘
                                      │
                       ┌──────────────▼──────────────┐
                       │   PartitionAuthSource       │
                       │                             │
                       │ - Auth requests/responses   │
                       │ - Permission management     │
                       │ - Connection indicators     │
                       └─────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Cross-Thread Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Main Thread              MessagePort          Worker      │
│  ┌──────────────┐        ◄─────────►        ┌──────────┐   │
│  │  ProxyBridge │                            │  Proxy   │   │
│  │  Partition   │                            │  Client  │   │
│  │              │                            │  Partition│  │
│  └──────┬───────┘                            └────┬─────┘   │
│         │                                         │         │
│  ┌──────▼────────┐                                │         │
│  │  LocalStorage │                                │         │
│  │   Partition   │                                │         │
│  └───────────────┘                                │         │
│                                                   │         │
└───────────────────────────────────────────────────┴─────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Data Flow Diagram                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User Action                                             │
│     ├─► applyEvents([botAdded(...)])                        │
│     │                                                       │
│  2. Partition Processing                                    │
│     ├─► Update internal state                               │
│     ├─► Apply to Yjs doc (if Yjs)                          │
│     ├─► Generate version vector                             │
│     │                                                       │
│  3. Emit Observables                                        │
│     ├─► onBotsAdded.next([bot])                            │
│     ├─► onStateUpdated.next(event)                         │
│     ├─► onVersionUpdated.next(version)                     │
│     │                                                       │
│  4. Network Sync (if remote)                                │
│     ├─► onInstUpdate emits Yjs update                      │
│     ├─► Send to InstRecordsClient                          │
│     ├─► Broadcast to other connected clients               │
│     │                                                       │
│  5. Receive Remote Update                                   │
│     ├─► applyEvents([applyUpdatesToInst])                  │
│     ├─► Apply Yjs update to doc                            │
│     ├─► Emit onBotsUpdated                                 │
│     └─► Runtime reflects changes                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Partition Types and Use Cases

**Memory Partition**:

-   Use for temporary, volatile data
-   Fast read/write
-   Lost on reload
-   Examples: UI state, temporary calculations, local-only bots

**Yjs Partition**:

-   Use for local persistence with CRDT
-   Survives reloads (IndexedDB)
-   Can be synced later
-   Examples: Offline work, local drafts, single-user mode

**Remote Yjs Partition**:

-   Use for real-time collaboration
-   Multi-user sync via server
-   Network-aware
-   Examples: Shared workspaces, multiplayer games, collaborative editing

**Other Players Partition**:

-   Use for player presence
-   Dynamic partition creation per player
-   Aggregates player state
-   Examples: Player lists, avatars, multiplayer sessions

### Realtime Strategies

**Immediate** (`immediate`):

-   Changes apply instantly to local state
-   Runtime sees updates immediately
-   Used by: Memory, Yjs, RemoteYjs partitions
-   Best for: Real-time interaction, immediate feedback

**Delayed** (`delayed`):

-   Changes queued until confirmation
-   Runtime waits for server acknowledgment
-   Used by: Some custom partitions
-   Best for: Server-authoritative systems, optimistic updates

### Version Vectors and Synchronization

**Version Vector**:

```typescript
interface CurrentVersion {
    currentSite: string; // Local site ID
    remoteSite: string; // Remote site ID
    vector: VersionVector; // Map of site -> version
}

interface VersionVector {
    [site: string]: number; // Each site's clock value
}
```

**Usage**:

-   Track causal order of edits
-   Detect conflicts
-   Enable operational transform
-   Support CRDT merging

**Example**:

```typescript
{
    currentSite: 'user1',
    remoteSite: 'server',
    vector: {
        'user1': 5,    // User1 has made 5 edits
        'user2': 3,    // User2 has made 3 edits
        'server': 10   // Server has 10 edits
    }
}
```

### Yjs Updates and Inst Protocol

**Update Structure**:

```typescript
interface InstUpdate {
    id: number; // Sequential update ID
    timestamp: number; // Creation timestamp
    update: string; // Base64-encoded Yjs update
}
```

**Protocol Actions**:

-   `apply_updates_to_inst`: Apply remote updates
-   `get_current_inst_update`: Get current state as update
-   `create_initialization_update`: Create init update for new clients
-   `get_inst_state_from_updates`: Decode state from updates
-   `list_inst_updates`: List available updates from server

**Workflow**:

1. Client makes changes → Yjs generates update
2. Update encoded to base64 → Sent to server
3. Server broadcasts to other clients
4. Other clients apply update → Merge with local state
5. No conflicts due to CRDT properties

### Remote Events and Actions

**Remote Event Types**:

-   `onRemoteWhisper`: Private message to specific user
-   `onRemoteData`: Data broadcast to all users
-   `remoteActions`: Generic remote actions

**Configuration**:

```typescript
remoteEvents: {
    onRemoteWhisper: true,   // Enable whispers
    onRemoteData: true,      // Enable data broadcasts
    remoteActions: false     // Disable generic actions
}
```

**Sending**:

```typescript
await partition.sendRemoteEvents([
    {
        type: 'remote',
        event: shout('onPlayerMoved', { x: 5, y: 10 }),
    },
]);
```

### Authentication and Permissions

**Auth Flow**:

1. Partition needs auth → Emit request via `PartitionAuthSource`
2. Runtime receives request → Prompt user or use stored credentials
3. Runtime provides auth → Respond via `PartitionAuthSource`
4. Partition receives auth → Connect to server

**Permission Flow**:

1. Partition attempts action → Check permission
2. If lacking → Request permission via `PartitionAuthSource`
3. Runtime evaluates → Grant or deny
4. Result returned → Partition proceeds or fails

**Permission Types**:

-   `read`: Read bot data
-   `create`: Create new bots
-   `update`: Modify existing bots
-   `delete`: Remove bots
-   `sendAction`: Send remote actions

### Space Organization

**Standard Spaces**:

-   `shared`: Persistent shared state (main workspace)
-   `tempShared`: Temporary shared state (session)
-   `remoteTempShared`: Remote temporary state (other users)
-   `local`: Local-only state (client-specific)
-   `otherPlayers`: Other player states (multiplayer)
-   `admin`: Admin-only state (restricted)

**Space Assignment**:

```typescript
partition.space = 'shared';
// All bots from this partition tagged with space='shared'
```

**Multiple Partitions**:

```typescript
const config: AuxPartitionConfig = {
    shared: { type: 'yjs_client', ... },
    tempShared: { type: 'memory', ... },
    local: { type: 'local_storage', namespace: 'my-app' },
    otherPlayers: { type: 'other_players_client', ... }
};
```

### Error Handling

**Common Errors**:

-   Connection errors: Network failures, timeouts
-   Auth errors: Not authorized, missing permissions
-   Size errors: Space too large, rate limited
-   Version errors: Conflict detection, merge failures

**Error Observables**:

```typescript
partition.onError.subscribe((error) => {
    if (error.code === 'not_authorized') {
        // Handle auth failure
    } else if (error.code === 'max_size_reached') {
        // Handle storage limit
    }
});
```

**Status Updates**:

```typescript
partition.onStatusUpdated.subscribe((status) => {
    if (status.type === 'connection') {
        console.log('Connection status:', status.connected);
    } else if (status.type === 'sync') {
        console.log('Sync progress:', status.progress);
    }
});
```

## Dependencies

The partitions module depends on:

-   **Yjs**: CRDT implementation for collaborative editing
-   **RxJS**: Observable streams for event handling
-   **base64-js**: Encoding/decoding Yjs updates
-   **uuid**: Generating unique IDs
-   **es-toolkit/compat**: Utility functions (sortBy, union)
-   **luxon**: Date/time handling
-   `@casual-simulation/aux-common/bots`: Bot types and actions
-   `@casual-simulation/aux-common/common`: Actions and events
-   `@casual-simulation/aux-common/documents`: Yjs document wrappers
-   `@casual-simulation/aux-common/websockets`: InstRecordsClient for networking
-   `@casual-simulation/aux-common/math`: Vector and rotation types
-   `@casual-simulation/aux-common/yjs`: Yjs helper utilities

## Integration Points

The partitions module integrates with:

-   **aux-runtime**: Main consumer, manages partition lifecycle
-   **aux-vm**: Uses partitions for bot state storage
-   **aux-records**: Server-side partition management
-   **aux-backend**: Database persistence for partitions
-   **aux-web**: UI for connection status and errors
-   **casualos-cli**: Command-line partition management

## Testing

The module includes comprehensive test files:

-   **AuxPartition.spec.ts**: Core partition interface tests
-   **MemoryPartition.spec.ts**: Memory partition tests (460+ tests)
-   **YjsPartition.spec.ts**: Yjs partition tests
-   **RemoteYjsPartition.spec.ts**: Remote sync tests
-   **OtherPlayersPartition.spec.ts**: Multi-user tests
-   **PartitionAuthSource.spec.ts**: Auth flow tests
-   **PartitionUtils.spec.ts**: Utility function tests
-   **test/PartitionTests.ts**: Shared test utilities
-   **test/UpdateCases.ts**: Update scenario test cases

## Related Packages

-   `@casual-simulation/aux-common/bots`: Bot types used by partitions
-   `@casual-simulation/aux-common/documents`: Yjs document abstractions
-   `@casual-simulation/aux-records`: Server-side record management
-   `@casual-simulation/aux-runtime`: Runtime that uses partitions
-   `@casual-simulation/aux-vm`: Virtual machines using partitions
