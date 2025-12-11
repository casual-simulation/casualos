# Websockets

WebSocket client infrastructure for real-time communication between CasualOS clients and servers. This folder provides the networking layer for inst records synchronization, device communication, and multi-user collaboration.

## Overview

The websockets module provides:

-   **Connection Management**: WebSocket connection lifecycle and state tracking
-   **Authentication**: Token-based authentication with permission management
-   **Inst Records Protocol**: Real-time synchronization of bot state updates (Yjs CRDT)
-   **Branch Watching**: Subscribe to changes on specific record/inst/branch paths
-   **Device Communication**: Send actions between connected devices
-   **Time Synchronization**: Server time sync for distributed systems
-   **Error Handling**: Comprehensive error codes and retry logic
-   **Large Message Support**: Upload/download mechanism for messages exceeding WebSocket limits

The module is used by RemoteYjsPartition and other networked partitions to enable real-time collaboration.

## Main Exports

### ConnectionClient (`ConnectionClient.ts`)

Base interface for WebSocket client connections (110 lines):

```typescript
import type {
    ConnectionClient,
    ClientConnectionState,
} from '@casual-simulation/aux-common/websockets';

interface ConnectionClient {
    // Connection state
    connectionState: Observable<ClientConnectionState>;
    isConnected: boolean;
    info: ConnectionInfo | null;
    indicator: ConnectionIndicator | null;
    origin: string;

    // Error handling
    onError: Observable<WebsocketErrorInfo>;

    // Event handling
    event<K extends WebsocketMessage['type']>(
        name: K
    ): Observable<WebsocketType<K>>;

    // Message sending
    send(message: WebsocketMessage): void;

    // Connection control
    connect(): void;
    disconnect(): void;
}

interface ClientConnectionState {
    connected: boolean;
    info: ConnectionInfo;
}
```

**Usage**:

```typescript
// Subscribe to connection state
client.connectionState.subscribe((state) => {
    if (state.connected) {
        console.log('Connected:', state.info);
    } else {
        console.log('Disconnected');
    }
});

// Subscribe to specific events
client.event('repo/add_updates').subscribe((message) => {
    console.log('Received updates:', message.updates);
});

// Send message
client.send({
    type: 'repo/watch_branch',
    recordName: 'myRecord',
    inst: 'myInst',
    branch: 'main',
});

// Control connection
client.connect();
client.disconnect();
```

**Type-Safe Event Handling**:

```typescript
// Type is automatically inferred based on event name
const addUpdates$ = client.event('repo/add_updates');
// Type: Observable<AddUpdatesMessage>

const loginResult$ = client.event('login_result');
// Type: Observable<LoginResultMessage>
```

### AuthenticatedConnectionClient (`AuthenticatedConnectionClient.ts`)

Connection client wrapper that handles authentication (252 lines):

```typescript
import { AuthenticatedConnectionClient } from '@casual-simulation/aux-common/websockets';
import type { PartitionAuthSource } from '@casual-simulation/aux-common/partitions';

// Create authenticated client
const authSource = new PartitionAuthSource();
const baseClient = new WebSocketConnectionClient('wss://server.com');
const authClient = new AuthenticatedConnectionClient(baseClient, authSource);

// Handle auth requests
authSource.onAuthRequest.subscribe((request) => {
    // Provide connection token
    authSource.respondToAuthRequest(request.id, {
        success: true,
        connectionToken: 'my-auth-token',
        connectionId: 'unique-connection-id',
    });
});

// Connection state only updates after successful login
authClient.connectionState.subscribe((state) => {
    if (state.connected) {
        console.log('Authenticated and connected');
    }
});

authClient.connect();
```

**Key Features**:

-   **Automatic Authentication**: Sends login message on connect
-   **Auth Requests**: Emits auth requests via PartitionAuthSource
-   **Login Retry**: Re-requests auth on login failure
-   **Permission Bridging**: Forwards permission requests between client/server
-   **Deduplication**: Filters duplicate disconnection events
-   **Transparent Proxy**: Forwards all other ConnectionClient methods

**Permission Handling**:

```typescript
// Listen for permission requests from server
authSource.onAuthPermissionRequest.subscribe((request) => {
    console.log('Permission requested:', request.action, request.resourceKind);

    // Grant permission
    authSource.respondToPermissionRequest(request.id, {
        success: true,
    });
});

// Permission requests are automatically forwarded to server
authClient.send({
    type: 'permission/request/missing',
    reason: {
        type: 'missing_permission',
        recordName: 'myRecord',
        resourceKind: 'inst',
        action: 'create',
        subjectType: 'user',
    },
});
```

### InstRecordsClient (`InstRecordsClient.ts`)

High-level client for inst records protocol (964 lines):

```typescript
import { InstRecordsClient } from '@casual-simulation/aux-common/websockets';

// Create client
const connectionClient = new AuthenticatedConnectionClient(
    baseClient,
    authSource
);
const instClient = new InstRecordsClient(connectionClient);

// Watch branch for updates
const branchUpdates$ = instClient.watchBranchUpdates({
    recordName: 'myRecord',
    inst: 'myInst',
    branch: 'main',
    temporary: false,
});

branchUpdates$.subscribe((event) => {
    if (event.type === 'sync') {
        console.log('Synced with server');
    } else if (event.type === 'updates') {
        console.log('Received updates:', event.updates);
    } else if (event.type === 'connection') {
        console.log('Connection state:', event.connected);
    }
});

// Send updates
await instClient.addUpdates({
    recordName: 'myRecord',
    inst: 'myInst',
    branch: 'main',
    updates: ['base64-encoded-yjs-update'],
    updateId: 1,
});

// Send device action (remote event)
await instClient.sendAction({
    recordName: 'myRecord',
    inst: 'myInst',
    branch: 'main',
    action: {
        type: 'device',
        event: {
            type: 'show_toast',
            message: 'Hello from another device!',
        },
        taskId: 'task123',
    },
});

// Get branch updates from server
const updates = await instClient
    .getBranchUpdates('myRecord', 'myInst', 'main')
    .pipe(first())
    .toPromise();

console.log('Stored updates:', updates.updates);

// Watch connected devices
const devices$ = instClient.watchBranchDevices('myRecord', 'myInst', 'main');
devices$.subscribe((event) => {
    if (event.type === 'repo/connected_to_branch') {
        console.log('Device connected:', event.connection);
    } else if (event.type === 'repo/disconnected_from_branch') {
        console.log('Device disconnected:', event.connection);
    }
});

// Get connection count
const count = await instClient.getConnectionCount('myRecord', 'myInst', 'main');
console.log('Connected devices:', count);

// Time synchronization
const serverTime = await instClient.sampleServerTime();
console.log('Server time offset:', serverTime.offset);

// Forced offline mode
instClient.forcedOffline = true; // Disconnect
instClient.forcedOffline = false; // Reconnect
```

**Branch Update Events**:

```typescript
type BranchUpdatesEvent =
    | { type: 'sync'; complete: true }
    | {
          type: 'updates';
          updates: string[];
          timestamps?: number[];
          initial: boolean;
      }
    | { type: 'connection'; connected: boolean }
    | { type: 'error'; kind: 'error'; info: WebsocketErrorInfo }
    | { type: 'error'; kind: 'permission_denied'; reason: DenialReason };
```

**Update Acknowledgement**:

```typescript
// Updates are automatically resent if not acknowledged
instClient.resendUpdatesAfterMs = 5000; // Resend after 5 seconds
instClient.resendUpdatesIntervalMs = 1000; // Check every second

// Exponential backoff: 5s, 10s, 20s, 40s...
```

**Device Actions**:

```typescript
// Send action to specific device
await instClient.sendAction({
    recordName: 'game',
    inst: 'session1',
    branch: 'main',
    action: {
        type: 'device',
        device: {
            connectionId: 'target-device-id',
            sessionId: 'target-session-id',
        },
        event: {
            type: 'custom_event',
            data: { value: 42 },
        },
        taskId: 'action123',
    },
});

// Broadcast to all devices
await instClient.sendAction({
    recordName: 'game',
    inst: 'session1',
    branch: 'main',
    action: {
        type: 'device',
        event: {
            type: 'player_joined',
            player: 'Alice',
        },
        taskId: 'broadcast123',
    },
});

// Receive device actions
const actions$ = instClient.event('repo/receive_action');
actions$.subscribe((message) => {
    console.log('Received action:', message.action);
});
```

### WebsocketEvents (`WebsocketEvents.ts`)

Message types and protocol definitions (1318 lines):

```typescript
import type {
    WebsocketMessage,
    WebsocketEvent,
    WebsocketErrorInfo,
    LoginMessage,
    LoginResultMessage,
    WatchBranchMessage,
    WatchBranchResultMessage,
    AddUpdatesMessage,
    UpdatesReceivedMessage,
    SendActionMessage,
    ReceiveDeviceActionMessage,
    ConnectedToBranchMessage,
    DisconnectedFromBranchMessage,
    TimeSyncRequestMessage,
    TimeSyncResponseMessage,
    RateLimitExceededMessage,
} from '@casual-simulation/aux-common/websockets';
```

**WebSocket Event Types**:

```typescript
enum WebsocketEventTypes {
    Message = 1, // Standard message
    UploadRequest = 2, // Request upload URL for large message
    UploadResponse = 3, // Upload URL response
    DownloadRequest = 4, // Download large message from URL
    Error = 5, // Error event
}

type WebsocketEvent =
    | [type: WebsocketEventTypes.Message, id: number, data: WebsocketMessage]
    | [type: WebsocketEventTypes.UploadRequest, id: number]
    | [
          type: WebsocketEventTypes.UploadResponse,
          id: number,
          url: string,
          method: string,
          headers: object
      ]
    | [
          type: WebsocketEventTypes.DownloadRequest,
          id: number,
          url: string,
          method: string,
          headers: object
      ]
    | [type: WebsocketEventTypes.Error, id: number, info: WebsocketErrorInfo];
```

**Login Protocol**:

```typescript
// Login request
interface LoginMessage {
    type: 'login';
    connectionToken?: string;
    connectionId?: string;
}

// Login result
type LoginResultMessage =
    | {
          type: 'login_result';
          success: true;
          info: ConnectionInfo;
      }
    | {
          type: 'login_result';
          success: false;
          errorCode: WebsocketErrorCode;
          errorMessage: string;
          reason?: DenialReason;
      };
```

**Branch Watch Protocol**:

```typescript
// Watch branch request
interface WatchBranchMessage {
    type: 'repo/watch_branch';
    recordName: string | null;
    inst: string;
    branch: string;
    temporary?: boolean;
    protocol?: 'updates';
    markers?: string[];
}

// Watch result
type WatchBranchResultMessage =
    | {
          type: 'repo/watch_branch_result';
          success: true;
          recordName: string | null;
          inst: string;
          branch: string;
      }
    | {
          type: 'repo/watch_branch_result';
          success: false;
          recordName: string | null;
          inst: string;
          branch: string;
          errorCode: WebsocketErrorCode;
          errorMessage: string;
          reason?: DenialReason;
      };

// Unwatch branch
interface UnwatchBranchMessage {
    type: 'repo/unwatch_branch';
    recordName: string | null;
    inst: string;
    branch: string;
}
```

**Updates Protocol**:

```typescript
// Add updates (client to server)
interface AddUpdatesMessage {
    type: 'repo/add_updates';
    recordName: string | null;
    inst: string;
    branch: string;
    updates: string[]; // Base64-encoded Yjs updates
    updateId: number;
}

// Updates received (server to client - acknowledgement)
interface UpdatesReceivedMessage {
    type: 'repo/updates_received';
    recordName: string | null;
    inst: string;
    branch: string;
    updateId: number;
}

// Get updates (fetch from server)
interface GetUpdatesMessage {
    type: 'repo/get_updates';
    recordName: string | null;
    inst: string;
    branch: string;
}

// Server sends updates via AddUpdatesMessage
```

**Device Communication**:

```typescript
// Send action
interface SendActionMessage {
    type: 'repo/send_action';
    recordName: string | null;
    inst: string;
    branch: string;
    action: DeviceAction;
}

// Receive action
interface ReceiveDeviceActionMessage {
    type: 'repo/receive_action';
    recordName: string | null;
    inst: string;
    branch: string;
    action: DeviceAction;
}

// Device action types
type DeviceAction = {
    type: 'device';
    device?: {
        connectionId?: string;
        sessionId?: string;
    };
    event: any;
    taskId?: string | number;
};
```

**Device Presence Protocol**:

```typescript
// Watch devices
interface WatchBranchDevicesMessage {
    type: 'repo/watch_branch_devices';
    recordName: string | null;
    inst: string;
    branch: string;
}

// Unwatch devices
interface UnwatchBranchDevicesMessage {
    type: 'repo/unwatch_branch_devices';
    recordName: string | null;
    inst: string;
    branch: string;
}

// Device connected
interface ConnectedToBranchMessage {
    type: 'repo/connected_to_branch';
    broadcast: boolean;
    recordName?: string | null;
    inst?: string;
    branch: {
        recordName: string | null;
        inst: string;
        branch: string;
    };
    connection: ConnectionInfo;
}

// Device disconnected
interface DisconnectedFromBranchMessage {
    type: 'repo/disconnected_from_branch';
    broadcast: boolean;
    recordName: string | null;
    inst: string;
    branch: string;
    connection: ConnectionInfo;
}

// Connection count
interface ConnectionCountMessage {
    type: 'repo/connection_count';
    recordName: string | null;
    inst: string;
    branch: string;
}
```

**Time Sync Protocol**:

```typescript
// Time sync request
interface TimeSyncRequestMessage {
    type: 'repo/time_sync';
    id: number;
    clientRequestTime: number;
}

// Time sync response
interface TimeSyncResponseMessage {
    type: 'repo/time_sync_response';
    id: number;
    clientRequestTime: number;
    serverReceiveTime: number;
    serverTransmitTime: number;
}
```

**Error Handling**:

```typescript
interface WebsocketErrorInfo {
    success: false;
    recordName?: string | null;
    inst?: string;
    branch?: string;
    errorCode: WebsocketErrorCode;
    errorMessage: string;
    issues?: z.core.$ZodIssue[];
    reason?: DenialReason;
}

type WebsocketErrorCode =
    | 'server_error'
    | 'not_supported'
    | 'invalid_record_key'
    | 'unacceptable_connection_token'
    | 'invalid_token'
    | 'session_expired'
    | 'user_is_banned'
    | 'unacceptable_connection_id'
    | 'message_not_found'
    | 'unacceptable_request'
    | 'record_not_found'
    | 'not_authorized'
    | 'action_not_supported'
    | 'not_logged_in'
    | 'subscription_limit_reached'
    | 'inst_not_found'
    | 'invalid_connection_state'
    | KnownErrorCodes;
```

**Rate Limiting**:

```typescript
interface RateLimitExceededMessage {
    type: 'rate_limit_exceeded';
    retryAfter: number; // Milliseconds until retry
}
```

**Permission Requests**:

```typescript
interface RequestMissingPermissionMessage {
    type: 'permission/request/missing';
    reason: DenialReason;
}

interface RequestMissingPermissionResponseMessage {
    type: 'permission/request/missing/response';
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
}
```

**HTTP Tunneling** (for large messages):

```typescript
interface WebsocketHttpRequestMessage {
    type: 'http/request';
    request: GenericHttpRequest;
}

interface WebsocketHttpResponseMessage {
    type: 'http/response';
    response: GenericHttpResponse;
}

interface WebsocketHttpPartialResponseMessage {
    type: 'http/response/part';
    response: Partial<GenericHttpResponse> & {
        statusCode: number;
    };
}
```

### MemoryConnectionClient (`MemoryConnectionClient.ts`)

In-memory connection client for testing (102 lines):

```typescript
import { MemoryConnectionClient } from '@casual-simulation/aux-common/websockets';

// Create test client
const client = new MemoryConnectionClient({
    connectionId: 'test-connection',
    sessionId: 'test-session',
    userId: 'test-user',
});

client.origin = 'http://localhost:3000';

// Simulate connection
client.connect();

// Check sent messages
client.send({
    type: 'repo/watch_branch',
    recordName: 'test',
    inst: 'test',
    branch: 'main',
});

console.log('Sent messages:', client.sentMessages);
// [{ type: 'repo/watch_branch', ... }]

// Simulate receiving event
const subject = new Subject();
client.events.set('repo/add_updates', subject);
subject.next({
    type: 'repo/add_updates',
    recordName: 'test',
    inst: 'test',
    branch: 'main',
    updates: ['update1'],
});

// Simulate disconnection
client.disconnect();
```

**Key Features**:

-   **No Network**: All operations are in-memory
-   **Sent Message Tracking**: Access `sentMessages` array
-   **Manual Event Emission**: Control event subjects manually
-   **Connection State Control**: Manual connect/disconnect
-   **Testing**: Perfect for unit tests

### InstRecordsClientTimeSyncConnection (`InstRecordsClientTimeSyncConnection.ts`)

Time synchronization adapter (42 lines):

```typescript
import { InstRecordsClientTimeSyncConnection } from '@casual-simulation/aux-common/websockets';
import { TimeSync } from '@casual-simulation/timesync';

// Create time sync connection
const instClient = new InstRecordsClient(connectionClient);
const timeSyncConnection = new InstRecordsClientTimeSyncConnection(instClient);

// Use with TimeSync
const timeSync = new TimeSync(timeSyncConnection);

// Start syncing
await timeSync.sync();

// Get synchronized time
const serverTime = timeSync.now();
console.log('Server time:', serverTime);

// Get offset
const offset = timeSync.offset;
console.log('Time offset (ms):', offset);
```

**Key Features**:

-   **TimeSync Integration**: Implements TimeSync connection interface
-   **Server Time Samples**: Delegates to InstRecordsClient.sampleServerTime()
-   **Clock Synchronization**: Enables accurate distributed timestamps

### Utils (`Utils.ts`)

Utility functions for branch/inst management (101 lines):

```typescript
import {
    branchNamespace,
    watchBranchNamespace,
    branchFromNamespace,
    formatInstId,
    parseInstId,
    normalizeInstId,
} from '@casual-simulation/aux-common/websockets';

// Create branch namespace
const namespace = branchNamespace('branch', 'myRecord', 'myInst', 'main');
// "/branch/myRecord/myInst/main"

const namespace2 = branchNamespace('branch', null, 'publicInst', 'main');
// "/branch//publicInst/main"

// Watch branch namespace
const watchNs = watchBranchNamespace('myRecord', 'myInst', 'main');
// "/watched_branch/myRecord/myInst/main"

// Parse namespace back to components
const parsed = branchFromNamespace('branch', '/branch/myRecord/myInst/main');
// { recordName: 'myRecord', inst: 'myInst', branch: 'main' }

const parsed2 = branchFromNamespace('branch', '/branch//publicInst/main');
// { recordName: null, inst: 'publicInst', branch: 'main' }

// Format inst ID
const instId = formatInstId('myRecord', 'myInst');
// "myRecord/myInst"

const publicInstId = formatInstId(null, 'publicInst');
// "/publicInst"

// Parse inst ID
const parsedInst = parseInstId('myRecord/myInst');
// { recordName: 'myRecord', inst: 'myInst' }

const parsedPublic = parseInstId('/publicInst');
// { recordName: null, inst: 'publicInst' }

// Normalize inst ID (legacy compatibility)
const normalized = normalizeInstId('oldInst');
// "/oldInst"

const alreadyNormalized = normalizeInstId('record/inst');
// "record/inst"
```

**Key Functions**:

-   `branchNamespace()`: Create namespace path for branch
-   `watchBranchNamespace()`: Create watch namespace path
-   `branchFromNamespace()`: Parse namespace to components
-   `formatInstId()`: Format record/inst as ID string
-   `parseInstId()`: Parse inst ID to components
-   `normalizeInstId()`: Normalize legacy inst IDs

## Usage Examples

### Basic Connection and Authentication

```typescript
import {
    AuthenticatedConnectionClient,
    InstRecordsClient,
} from '@casual-simulation/aux-common/websockets';
import { PartitionAuthSource } from '@casual-simulation/aux-common/partitions';

// Set up auth source
const authSource = new PartitionAuthSource();

// Provide auth when requested
authSource.onAuthRequest.subscribe((request) => {
    authSource.respondToAuthRequest(request.id, {
        success: true,
        connectionToken: 'your-auth-token',
        connectionId: 'unique-client-id',
    });
});

// Create connection (WebSocket implementation not shown)
const baseClient = createWebSocketClient('wss://api.casualos.com');

// Wrap with authentication
const authClient = new AuthenticatedConnectionClient(baseClient, authSource);

// Create inst records client
const instClient = new InstRecordsClient(authClient);

// Connect
authClient.connect();

// Wait for connection
await authClient.connectionState
    .pipe(
        filter((s) => s.connected),
        first()
    )
    .toPromise();

console.log('Connected and authenticated');
```

### Real-Time Collaboration

```typescript
import { InstRecordsClient } from '@casual-simulation/aux-common/websockets';

// Watch branch for updates
const updates$ = instClient.watchBranchUpdates({
    recordName: 'project',
    inst: 'workspace',
    branch: 'main',
    temporary: false,
});

// Handle different event types
updates$.subscribe((event) => {
    switch (event.type) {
        case 'sync':
            console.log('Initial sync complete');
            break;

        case 'updates':
            console.log('Received updates:', event.updates.length);
            if (event.initial) {
                console.log('Initial state loaded');
            }
            // Apply Yjs updates to local doc
            event.updates.forEach((update) => {
                const bytes = toByteArray(update);
                applyUpdate(doc, bytes);
            });
            break;

        case 'connection':
            if (event.connected) {
                console.log('Connected to branch');
            } else {
                console.log('Disconnected from branch');
            }
            break;

        case 'error':
            console.error('Error:', event.info || event.reason);
            break;
    }
});

// Send local updates to server
doc.on('update', (update: Uint8Array) => {
    const base64Update = fromByteArray(update);
    instClient.addUpdates({
        recordName: 'project',
        inst: 'workspace',
        branch: 'main',
        updates: [base64Update],
        updateId: updateCounter++,
    });
});
```

### Multi-User Presence

```typescript
// Track connected users
const devices$ = instClient.watchBranchDevices('project', 'workspace', 'main');

const connectedUsers = new Set<string>();

devices$.subscribe((event) => {
    if (event.type === 'repo/connected_to_branch') {
        const userId = event.connection.userId;
        connectedUsers.add(userId);
        console.log(`User ${userId} joined (${connectedUsers.size} online)`);

        // Update UI
        updateUserList([...connectedUsers]);
    } else if (event.type === 'repo/disconnected_from_branch') {
        const userId = event.connection.userId;
        connectedUsers.delete(userId);
        console.log(`User ${userId} left (${connectedUsers.size} online)`);

        // Update UI
        updateUserList([...connectedUsers]);
    }
});

// Get current connection count
const count = await instClient.getConnectionCount(
    'project',
    'workspace',
    'main'
);
console.log(`Currently ${count} users connected`);
```

### Remote Events Between Devices

```typescript
// Send remote event to all devices
await instClient.sendAction({
    recordName: 'game',
    inst: 'session1',
    branch: 'main',
    action: {
        type: 'device',
        event: {
            type: 'player_moved',
            playerId: 'player123',
            position: { x: 10, y: 20, z: 0 },
        },
        taskId: 'move-action-1',
    },
});

// Send remote event to specific device
await instClient.sendAction({
    recordName: 'game',
    inst: 'session1',
    branch: 'main',
    action: {
        type: 'device',
        device: {
            connectionId: 'target-connection-id',
            sessionId: 'target-session-id',
        },
        event: {
            type: 'private_message',
            from: 'player1',
            message: 'Hello!',
        },
        taskId: 'whisper-1',
    },
});

// Receive remote events
const actions$ = instClient.event('repo/receive_action');
actions$.subscribe((message) => {
    const action = message.action;
    if (action.type === 'device') {
        handleRemoteEvent(action.event);
    }
});

function handleRemoteEvent(event: any) {
    switch (event.type) {
        case 'player_moved':
            updatePlayerPosition(event.playerId, event.position);
            break;
        case 'private_message':
            showMessage(event.from, event.message);
            break;
    }
}
```

### Time Synchronization

```typescript
import { InstRecordsClientTimeSyncConnection } from '@casual-simulation/aux-common/websockets';
import { TimeSync } from '@casual-simulation/timesync';

// Create time sync
const timeSyncConn = new InstRecordsClientTimeSyncConnection(instClient);
const timeSync = new TimeSync(timeSyncConn);

// Perform initial sync
await timeSync.sync();

// Get synchronized server time
const serverNow = timeSync.now();
console.log('Server time:', new Date(serverNow));

// Get offset
const offset = timeSync.offset;
console.log('Time offset:', offset, 'ms');

// Use for timestamps
const eventTime = timeSync.now();
await instClient.sendAction({
    recordName: 'game',
    inst: 'session1',
    branch: 'main',
    action: {
        type: 'device',
        event: {
            type: 'event_with_timestamp',
            timestamp: eventTime,
            data: { value: 42 },
        },
        taskId: 'timed-event-1',
    },
});
```

### Error Handling and Retry Logic

```typescript
// Handle connection errors
instClient.onError.subscribe((error) => {
    console.error('Connection error:', error);

    switch (error.errorCode) {
        case 'not_authorized':
            console.error('Not authorized for:', error.recordName, error.inst);
            // Re-authenticate
            break;

        case 'subscription_limit_reached':
            console.error('Too many subscriptions');
            // Unwatch some branches
            break;

        case 'inst_not_found':
            console.error('Inst not found:', error.inst);
            // Create inst or handle missing resource
            break;

        case 'rate_limit_exceeded':
            console.error('Rate limited');
            // Back off
            break;

        default:
            console.error(
                'Unknown error:',
                error.errorCode,
                error.errorMessage
            );
    }
});

// Handle rate limiting
instClient.watchRateLimitExceeded().subscribe((message) => {
    console.log(`Rate limited. Retry after ${message.retryAfter}ms`);

    // Pause operations
    setTimeout(() => {
        console.log('Resuming operations');
        // Resume
    }, message.retryAfter);
});

// Configure automatic update resending
instClient.resendUpdatesAfterMs = 5000; // Resend after 5 seconds
instClient.resendUpdatesIntervalMs = 1000; // Check every second

// Exponential backoff automatically applied: 5s, 10s, 20s, 40s...
```

### Testing with MemoryConnectionClient

```typescript
import {
    MemoryConnectionClient,
    InstRecordsClient,
} from '@casual-simulation/aux-common/websockets';

// Create test client
const memClient = new MemoryConnectionClient({
    connectionId: 'test-conn',
    sessionId: 'test-session',
    userId: 'test-user',
});

const instClient = new InstRecordsClient(memClient);

// Simulate connection
memClient.connect();

// Test sending messages
instClient.addUpdates({
    recordName: 'test',
    inst: 'test',
    branch: 'main',
    updates: ['update1'],
    updateId: 1,
});

// Verify message was sent
expect(memClient.sentMessages).toContainEqual({
    type: 'repo/add_updates',
    recordName: 'test',
    inst: 'test',
    branch: 'main',
    updates: ['update1'],
    updateId: 1,
});

// Simulate receiving updates
const addUpdatesSubject = new Subject();
memClient.events.set('repo/add_updates', addUpdatesSubject);

const receivedUpdates: string[] = [];
instClient.watchBranchUpdates('test', 'test', 'main').subscribe((event) => {
    if (event.type === 'updates') {
        receivedUpdates.push(...event.updates);
    }
});

addUpdatesSubject.next({
    type: 'repo/add_updates',
    recordName: 'test',
    inst: 'test',
    branch: 'main',
    updates: ['update2', 'update3'],
});

expect(receivedUpdates).toEqual(['update2', 'update3']);
```

### Temporary Branches (Ephemeral Collaboration)

```typescript
// Create temporary branch (no persistence)
const tempUpdates$ = instClient.watchBranchUpdates({
    recordName: null, // No record (public, temporary)
    inst: 'temp-session-abc123',
    branch: 'collab',
    temporary: true,
});

// Temporary branch lifecycle:
// 1. Created when first watcher connects
// 2. All watchers share real-time state
// 3. Deleted when last watcher disconnects
// 4. No data persisted to database

tempUpdates$.subscribe((event) => {
    if (event.type === 'sync') {
        console.log('Temporary branch ready');
    }
});

// Useful for:
// - Chat rooms
// - Real-time whiteboard
// - Temporary game sessions
// - Ephemeral collaboration spaces
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    CasualOS Application                      │
├──────────────────────────────────────────────────────────────┤
│  RemoteYjsPartition, OtherPlayersPartition                   │
└───────────────────────┬──────────────────────────────────────┘
                        │
        ┌───────────────┴────────────────┐
        │                                │
┌───────▼──────────────┐    ┌───────────▼────────────────────┐
│  InstRecordsClient   │    │  PartitionAuthSource           │
│                      │    │                                │
│ - watchBranchUpdates │    │ - Auth requests/responses      │
│ - addUpdates         │    │ - Permission management        │
│ - sendAction         │    │ - Connection indicators        │
│ - watchBranchDevices │    └────────────────────────────────┘
│ - getConnectionCount │
│ - sampleServerTime   │
└───────┬──────────────┘
        │
┌───────▼────────────────────────────────────────────────────┐
│        AuthenticatedConnectionClient                       │
│                                                            │
│ - Automatic login on connect                               │
│ - Auth request/response coordination                       │
│ - Permission request forwarding                            │
│ - Connection state filtering                               │
└───────┬────────────────────────────────────────────────────┘
        │
┌───────▼────────────────────────────────────────────────────┐
│              ConnectionClient (Interface)                  │
│                                                            │
│ - event<K>(name: K): Observable<WebsocketType<K>>         │
│ - send(message: WebsocketMessage)                          │
│ - connectionState: Observable<ClientConnectionState>       │
│ - connect() / disconnect()                                 │
└───────┬────────────────────────────────────────────────────┘
        │
        ├────────────────┬───────────────────┐
        │                │                   │
┌───────▼────────┐  ┌───▼──────────┐  ┌────▼─────────────┐
│  WebSocket     │  │   Memory     │  │   Custom         │
│  Client        │  │   Client     │  │   Transport      │
│  (Production)  │  │   (Testing)  │  │   (Extension)    │
└────────────────┘  └──────────────┘  └──────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   Protocol Flow Diagram                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Client                           Server                     │
│    │                                │                        │
│    │ WebSocket Connect              │                        │
│    ├───────────────────────────────>│                        │
│    │                                │                        │
│    │ login (token, connectionId)    │                        │
│    ├───────────────────────────────>│                        │
│    │                                │                        │
│    │     login_result (success)     │                        │
│    │<───────────────────────────────┤                        │
│    │                                │                        │
│    │ repo/watch_branch              │                        │
│    ├───────────────────────────────>│                        │
│    │                                │                        │
│    │  repo/watch_branch_result      │                        │
│    │<───────────────────────────────┤                        │
│    │                                │                        │
│    │  repo/add_updates (initial)    │                        │
│    │<───────────────────────────────┤                        │
│    │                                │                        │
│    │  [Local change made]           │                        │
│    │                                │                        │
│    │  repo/add_updates (new)        │                        │
│    ├───────────────────────────────>│                        │
│    │                                │                        │
│    │    repo/updates_received       │                        │
│    │<───────────────────────────────┤                        │
│    │                                │                        │
│    │    [Broadcast to other clients]│                        │
│    │                                │                        │
│    │  repo/add_updates (from other) │                        │
│    │<───────────────────────────────┤                        │
│    │                                │                        │
│    │  repo/send_action              │                        │
│    ├───────────────────────────────>│                        │
│    │                                │                        │
│    │  repo/receive_action           │                        │
│    │<───────────────────────────────┤                        │
│    │                                │                        │
│    │ repo/unwatch_branch            │                        │
│    ├───────────────────────────────>│                        │
│    │                                │                        │
└──────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Connection Lifecycle

**States**:

1. **Disconnected**: No WebSocket connection
2. **Connecting**: WebSocket connecting
3. **Authenticating**: Logged in, waiting for login result
4. **Connected**: Authenticated and ready
5. **Reconnecting**: Connection lost, attempting reconnect

**Connection Management**:

```typescript
// Manual control
client.connect(); // Start connection
client.disconnect(); // Stop connection

// Forced offline (disable reconnection)
instClient.forcedOffline = true; // Disconnect and stay offline
instClient.forcedOffline = false; // Allow reconnection

// Automatic reconnection (implementation-dependent)
```

### Branch Hierarchy

**Structure**: `recordName / inst / branch`

-   **Record**: Top-level namespace (can be null for public/temporary)
-   **Inst**: Instance/workspace within record
-   **Branch**: Specific branch within inst (like git branches)

**Examples**:

```typescript
// Private, persistent
{ recordName: 'myCompany', inst: 'project1', branch: 'main' }

// Public, persistent
{ recordName: null, inst: 'publicSpace', branch: 'lobby' }

// Temporary, ephemeral
{ recordName: null, inst: 'temp-session-123', branch: 'collab', temporary: true }
```

### Updates Protocol (Yjs CRDT)

**Update Flow**:

1. Client makes local change → Yjs generates update
2. Client sends `repo/add_updates` with update ID
3. Server acknowledges with `repo/updates_received`
4. Server broadcasts to other watchers via `repo/add_updates`
5. Clients apply updates to local Yjs doc

**Update Acknowledgement**:

-   Client tracks sent updates by update ID
-   Server confirms receipt with `repo/updates_received`
-   Unacknowledged updates resent after timeout (exponential backoff)
-   Prevents data loss on network issues

**Update Ordering**:

-   Yjs CRDT ensures convergence regardless of order
-   No strict ordering required (eventually consistent)
-   Version vectors track causal relationships

### Device Communication

**Broadcast vs Unicast**:

```typescript
// Broadcast to all devices (no device specified)
action: {
    type: 'device',
    event: { type: 'global_event', data: 'value' }
}

// Unicast to specific device
action: {
    type: 'device',
    device: {
        connectionId: 'target-connection',
        sessionId: 'target-session'
    },
    event: { type: 'private_event', data: 'value' }
}
```

**Device Actions**:

-   Arbitrary JSON events
-   Delivered in real-time
-   Not persisted (ephemeral)
-   Used for remote procedure calls, notifications, etc.

### Large Message Handling

**Upload/Download Protocol**:

1. Client sends large message → Too big for WebSocket
2. Server responds with `UploadRequest`
3. Client uploads to provided URL (HTTP)
4. Client confirms upload complete
5. Server processes uploaded data

**Download**:

1. Server has large message for client
2. Server sends `DownloadRequest` with URL
3. Client downloads from URL (HTTP)
4. Client processes downloaded data

**Thresholds** (implementation-specific):

-   Typically ~1-5 MB WebSocket message limit
-   Large messages use HTTP upload/download

### Time Synchronization

**Purpose**:

-   Consistent timestamps across distributed systems
-   Event ordering
-   Animation synchronization
-   Latency compensation

**Algorithm** (NTP-like):

1. Client sends `time_sync` with client request time
2. Server receives at server receive time
3. Server responds with server transmit time
4. Client receives at client receive time
5. Calculate offset and round-trip time

**Usage**:

```typescript
const serverTime = timeSync.now();
// Local time + offset = server time
```

### Error Codes

**Authentication**:

-   `invalid_token`: Auth token invalid or expired
-   `session_expired`: Session no longer valid
-   `not_logged_in`: Operation requires authentication
-   `user_is_banned`: User account banned

**Authorization**:

-   `not_authorized`: Insufficient permissions
-   `action_not_supported`: Action not allowed

**Resources**:

-   `record_not_found`: Record doesn't exist
-   `inst_not_found`: Inst doesn't exist

**Limits**:

-   `subscription_limit_reached`: Too many subscriptions
-   `rate_limit_exceeded`: Rate limit triggered

**Protocol**:

-   `invalid_connection_state`: Invalid state for operation
-   `unacceptable_request`: Malformed request
-   `message_not_found`: Referenced message not found

**Server**:

-   `server_error`: Internal server error
-   `not_supported`: Feature not supported

## Dependencies

The websockets module depends on:

-   **RxJS**: Observable streams for events
-   **Zod**: Schema validation for messages
-   **@casual-simulation/timesync**: Time synchronization library
-   `@casual-simulation/aux-common/common`: Common types (ConnectionInfo, RemoteActions)
-   `@casual-simulation/aux-common/partitions`: PartitionAuthSource
-   `@casual-simulation/aux-common/Errors`: Error types
-   `@casual-simulation/aux-common/http`: HTTP interface types

## Integration Points

The websockets module integrates with:

-   **RemoteYjsPartition**: Uses InstRecordsClient for synchronization
-   **OtherPlayersPartition**: Uses InstRecordsClient for player discovery
-   **PartitionAuthSource**: Coordinates authentication
-   **aux-records**: Server-side WebSocket handling
-   **aux-backend**: Database persistence for updates
-   **aux-web**: UI connection status indicators

## Testing

The module includes comprehensive test files:

-   **ConnectionClient.spec.ts**: Connection client interface tests
-   **AuthenticatedConnectionClient.spec.ts**: Authentication flow tests
-   **InstRecordsClient.spec.ts**: Inst records protocol tests
-   **Utils.spec.ts**: Utility function tests
-   **MemoryConnectionClient**: In-memory client for testing

## Related Packages

-   `@casual-simulation/aux-common/partitions`: Partition implementations using websockets
-   `@casual-simulation/aux-records`: Server-side WebSocket handlers
-   `@casual-simulation/aux-backend`: Backend services for inst records
-   `@casual-simulation/timesync`: Time synchronization library
