# Common

Core types, utilities, and interfaces used throughout CasualOS. This folder contains foundational types for actions, connections, status updates, permissions, and configuration.

## Overview

The `common` module provides shared primitives that form the foundation of CasualOS's communication, authorization, and configuration systems. It includes:

-   **Action System**: Base types for all actions in CasualOS
-   **Connection Management**: Types for tracking client connections and sessions
-   **Remote Communication**: Actions for device-to-device messaging
-   **Status Updates**: Progress reporting and connection state tracking
-   **Policy & Permissions**: Authorization system with 1700+ lines of permission types
-   **Configuration**: Web client configuration and BIOS options
-   **Version Management**: Semantic version parsing and formatting
-   **Privacy Features**: User privacy control types
-   **Utility Functions**: Iterator helpers and connection token parsing

## Main Exports

### Action (`Action.ts`)

Base interface for all actions in the CasualOS system:

```typescript
import { Action } from '@casual-simulation/aux-common/common';

interface Action {
    type: string; // Action type identifier
    uncopiable?: boolean; // Whether action can be structure cloned
}
```

All events and operations in CasualOS extend this base interface.

### RemoteActions (`RemoteActions.ts`)

Types for device-to-device communication and remote action execution:

```typescript
import {
    RemoteAction,
    RemoteActionResult,
    RemoteActionError,
    DeviceAction,
    DeviceSelector,
} from '@casual-simulation/aux-common/common';

// Send an action to a remote device
const remoteAction: RemoteAction = {
    type: 'remote',
    userId: 'user123', // Target user
    sessionId: 'session456', // Or target session
    connectionId: 'conn789', // Or specific connection
    broadcast: false, // Or broadcast to all
    event: {
        type: 'custom_event',
        data: { message: 'Hello' },
    },
    allowBatching: true, // Allow batching with other actions
    taskId: 'task001', // Track this specific task
};

// Receive action from remote device
interface DeviceAction {
    type: 'device';
    connection: ConnectionInfo; // Who sent it
    event: Action; // The actual event
    taskId?: number | string; // Task tracking ID
}

// Send result back to remote device
const result: RemoteActionResult = {
    type: 'remote_result',
    result: { success: true },
    taskId: 'task001',
};

// Send error back to remote device
const error: RemoteActionError = {
    type: 'remote_error',
    error: 'Something went wrong',
    taskId: 'task001',
};
```

**Device Selector Options**:

-   `connectionId`: Target specific connection
-   `sessionId`: Target all connections in a session
-   `userId`: Target all sessions for a user
-   `broadcast`: Send to everyone

**Key Features**:

-   Request/response pattern with task IDs
-   Flexible targeting (connection, session, user, broadcast)
-   Optional batching for performance
-   Error handling with typed error responses
-   Zod schemas for validation

### ConnectionInfo (`ConnectionInfo.ts`)

Identifies a client connection:

```typescript
import {
    ConnectionInfo,
    connectionInfo,
} from '@casual-simulation/aux-common/common';

interface ConnectionInfo {
    connectionId: string; // Unique connection ID
    sessionId: string | null; // Session ID
    userId: string | null; // User ID
}

// Create connection info
const info = connectionInfo('user123', 'session456', 'conn789');
```

### ConnectionIndicator (`ConnectionIndicator.ts`)

Represents connection establishment information:

```typescript
import {
    ConnectionIndicator,
    ConnectionIndicatorToken,
    ConnectionIndicatorId,
    getConnectionId,
} from '@casual-simulation/aux-common/common';

// Two ways to indicate a connection:

// 1. Using a connection token
const tokenIndicator: ConnectionIndicatorToken = {
    connectionToken: 'vCT1.encoded_token_here',
};

// 2. Using a connection ID directly
const idIndicator: ConnectionIndicatorId = {
    connectionId: 'conn789',
};

// Extract connection ID from either type
const connId = getConnectionId(indicator);
```

### ConnectionToken (`ConnectionToken.ts`)

Parse and format connection tokens for secure connection establishment:

```typescript
import {
    formatV1ConnectionToken,
    parseConnectionToken,
    parseV1ConnectionToken,
} from '@casual-simulation/aux-common/common';

// Format a connection token
const token = formatV1ConnectionToken(
    'user123', // userId
    'session456', // sessionId
    'conn789', // connectionId
    'myRecord', // recordName
    'inst001', // inst ID
    'hash_value' // security hash
);
// Returns: "vCT1.base64userId.base64SessionId.base64ConnectionId.base64RecordName.base64Inst.base64Hash"

// Parse a connection token
const [userId, sessionId, connectionId, recordName, inst, hash] =
    parseConnectionToken(token);

// Validate token format
const parsed = parseV1ConnectionToken(token);
if (!parsed) {
    console.error('Invalid token format');
}
```

**Token Format**: `vCT1.{base64UserId}.{base64SessionId}.{base64ConnectionId}.{base64RecordName}.{base64Inst}.{base64Hash}`

### StatusUpdate (`StatusUpdate.ts`)

Status messages for connection, authentication, synchronization, and progress:

```typescript
import {
    StatusUpdate,
    ConnectionMessage,
    AuthenticationMessage,
    AuthorizationMessage,
    SyncMessage,
    InitMessage,
    ProgressMessage,
    ConsoleMessages,
} from '@casual-simulation/aux-common/common';

// Connection status
const connectionMsg: ConnectionMessage = {
    type: 'connection',
    connected: true,
};

// Authentication status
const authMsg: AuthenticationMessage = {
    type: 'authentication',
    authenticated: true,
    info: {
        userId: 'user123',
        sessionId: 'session456',
        connectionId: 'conn789',
    },
    reason: 'invalid_token', // If authentication failed
};

// Authorization status
const authzMsg: AuthorizationMessage = {
    type: 'authorization',
    authorized: false,
    error: {
        /* WebsocketErrorInfo */
    },
};

// Sync status
const syncMsg: SyncMessage = {
    type: 'sync',
    synced: true,
};

// Initialization complete
const initMsg: InitMessage = {
    type: 'init',
};

// Progress update
const progressMsg: ProgressMessage = {
    type: 'progress',
    message: 'Loading bots...',
    progress: 0.65, // 0.0 to 1.0
    done: false,
    error: false,
    title: 'Loading Instance',
};

// Console messages
const consoleLog: ConsoleLogMessage = {
    type: 'log',
    messages: ['Debug info'],
};
```

**Status Update Types**:

-   `connection`: Connection established/lost
-   `authentication`: User authenticated
-   `authorization`: User authorized for resource
-   `sync`: Data synchronized
-   `init`: Channel fully initialized
-   `message`: Generic status message
-   `progress`: Loading progress (0-1)
-   `log`/`warn`/`error`: Console messages

### StatusUpdateUtils (`StatusUpdateUtils.ts`)

Utility functions for working with status updates (see implementation for specific utilities).

### PolicyPermissions (`PolicyPermissions.ts`)

Comprehensive permission system with 1700+ lines defining resource access control:

```typescript
import {
    SubjectType,
    ResourceKinds,
    ActionKinds,
    // Specific resource kinds
    DATA_RESOURCE_KIND,
    FILE_RESOURCE_KIND,
    EVENT_RESOURCE_KIND,
    INST_RESOURCE_KIND,
    WEBHOOK_RESOURCE_KIND,
    DATABASE_RESOURCE_KIND,
    // Specific actions
    READ_ACTION,
    CREATE_ACTION,
    UPDATE_ACTION,
    DELETE_ACTION,
    LIST_ACTION,
    GRANT_PERMISSION_ACTION,
    REVOKE_PERMISSION_ACTION,
} from '@casual-simulation/aux-common/common';

// Subject types: who is affected by permissions
type SubjectType = 'user' | 'inst' | 'role';

// Resource kinds: what can be accessed
type ResourceKinds =
    | 'data' // Bot data
    | 'file' // File storage
    | 'event' // Events
    | 'marker' // Markers
    | 'role' // Roles
    | 'inst' // Instances
    | 'webhook' // Webhooks
    | 'notification' // Notifications
    | 'package' // Packages
    | 'package.version' // Package versions
    | 'search' // Search
    | 'loom' // Loom AI
    | 'ai.sloyd' // Sloyd AI
    | 'ai.hume' // Hume AI
    | 'ai.openai.realtime' // OpenAI Realtime
    | 'database' // Database
    | 'purchasableItem' // Purchasable items
    | 'contract' // Contracts
    | 'invoice'; // Invoices

// Action kinds: what can be done
type ActionKinds =
    | 'read'
    | 'create'
    | 'update'
    | 'delete'
    | 'assign'
    | 'unassign'
    | 'increment'
    | 'count'
    | 'list'
    | 'grantPermission'
    | 'revokePermission'
    | 'grant'
    | 'revoke'
    | 'sendAction'
    | 'updateData'
    | 'run'
    | 'send'
    | 'subscribe'
    | 'unsubscribe';
```

**Key Features**:

-   Fine-grained access control for 20+ resource types
-   20+ action types for different operations
-   Subject-based permissions (user, inst, role)
-   Zod schemas for validation
-   Constants for all resource kinds and actions

### DenialReason (`DenialReason.ts`)

Types for authorization denial reasons:

```typescript
import {
    DenialReason,
    AuthorizeActionMissingPermission,
    AuthorizeActionDisabledPrivacyFeature,
    AuthorizeActionTooManyMarkers,
    AuthorizeActionInvalidToken,
} from '@casual-simulation/aux-common/common';

// Permission missing
const missingPermission: AuthorizeActionMissingPermission = {
    type: 'missing_permission',
    recordName: 'myRecord',
    subjectType: 'user',
    subjectId: 'user123',
    resourceKind: 'data',
    action: 'read',
    resourceId: 'bot456',
};

// Privacy feature disabled
const disabledFeature: AuthorizeActionDisabledPrivacyFeature = {
    type: 'disabled_privacy_feature',
    recordName: 'myRecord',
    subjectType: 'user',
    subjectId: 'user123',
    resourceKind: 'ai.openai.realtime',
    action: 'run',
    resourceId: 'model',
    feature: 'allowAI', // Which privacy feature is disabled
};

// Too many markers
const tooManyMarkers: AuthorizeActionTooManyMarkers = {
    type: 'too_many_markers',
    recordName: 'myRecord',
    subjectType: 'inst',
    subjectId: 'inst001',
    resourceKind: 'marker',
    action: 'create',
    maxAllowed: 100,
};

// Invalid token
const invalidToken: AuthorizeActionInvalidToken = {
    type: 'invalid_token',
    recordName: 'myRecord',
    subjectType: 'user',
    subjectId: 'user123',
};
```

### PrivacyFeatures (`PrivacyFeatures.ts`)

User privacy settings and feature flags:

```typescript
import { PrivacyFeatures } from '@casual-simulation/aux-common/common';

interface PrivacyFeatures {
    publishData: boolean; // Can publish data publicly
    allowPublicData: boolean; // Can access public data
    allowAI: boolean; // Can use AI features
    allowPublicInsts: boolean; // Can access public instances
}

// Check if user can use AI
if (!privacyFeatures.allowAI) {
    throw new Error('AI features disabled for privacy');
}
```

### WebConfig (`WebConfig.ts`)

Configuration for the web client (368 lines):

```typescript
import { WebConfig, BiosOption } from '@casual-simulation/aux-common/common';

interface WebConfig {
    version: 1 | 2 | null;
    causalRepoConnectionProtocol: RemoteCausalRepoProtocol;
    causalRepoConnectionUrl?: string | null;
    collaborativeRepoLocalPersistence?: boolean;
    // ... many more configuration options
}

// BIOS options for instance creation/management
type BiosOption =
    | 'enter join code'
    | 'join inst'
    | 'temp' // Temporary instance (no persistence)
    | 'static inst' // Static instance
    | 'local inst' // Local instance
    | 'local'
    | 'public inst' // Public partition
    | 'free inst'
    | 'free'
    | 'private inst' // Private partition
    | 'studio inst'
    | 'studio'
    | 'locked'
    | 'sign in' // Prompt sign in
    | 'sign up' // Prompt sign up
    | 'sign out' // Log out
    | 'delete inst'; // Delete instance
```

**Key Features**:

-   Protocol version negotiation
-   Connection URL configuration
-   Local persistence settings
-   Instance creation options
-   Authentication flow control

### Version (`Version.ts`)

Semantic version parsing and formatting:

```typescript
import {
    VersionNumber,
    parseVersionNumber,
    formatVersionNumber,
} from '@casual-simulation/aux-common/common';

interface VersionNumber {
    version: string | null; // Full version string
    major: number | null; // Major version
    minor: number | null; // Minor version
    patch: number | null; // Patch version
    alpha: boolean | number | null; // Is alpha? Or alpha number
    tag: string | null; // Prerelease tag
}

// Parse a version string
const version = parseVersionNumber('v1.2.3-alpha.5');
// Returns: { version: 'v1.2.3-alpha.5', major: 1, minor: 2, patch: 3, alpha: 5, tag: 'alpha.5' }

// Format a version number
const versionStr = formatVersionNumber(1, 2, 3, 'beta.1');
// Returns: "v1.2.3-beta.1"

// Handle null/undefined
const invalid = parseVersionNumber(null);
// Returns: { version: null, major: null, minor: null, patch: null, alpha: null, tag: null }
```

**Supported Formats**:

-   `v1.2.3` - Standard semantic version
-   `1.2.3` - Without 'v' prefix
-   `v1.2.3-alpha` - With prerelease tag
-   `v1.2.3-alpha.5` - With prerelease number

### CurrentVersion (`CurrentVersion.ts`)

Current CasualOS version information (exported types/values from this module).

### LoadingProgress (`LoadingProgress.ts`)

Progress tracking for loading operations:

```typescript
import {
    ProgressStatus,
    LoadingProgressCallback,
} from '@casual-simulation/aux-common/common';

interface ProgressStatus {
    message?: string; // Status message
    progressPercent?: number; // 0.0 to 1.0
    error?: string; // Error message if failed
}

type LoadingProgressCallback = (status: ProgressStatus) => void;

// Use in async operations
async function loadData(onProgress: LoadingProgressCallback) {
    onProgress({ message: 'Starting...', progressPercent: 0.0 });

    // Do work...
    onProgress({ message: 'Loading data...', progressPercent: 0.5 });

    // Complete
    onProgress({ message: 'Done', progressPercent: 1.0 });
}
```

### Iterators (`Iterators.ts`)

Utility functions for working with iterables:

```typescript
import { first, last, nth } from '@casual-simulation/aux-common/common';

const mySet = new Set([1, 2, 3, 4, 5]);

// Get first item
const firstItem = first(mySet); // 1

// Get last item
const lastItem = last(mySet); // 5

// Get nth item (0-indexed)
const thirdItem = nth(mySet, 2); // 3

// Handle empty iterables
const empty = first(new Set()); // undefined
```

### PublicUserInfo (`PublicUserInfo.ts`)

Public user information:

```typescript
import { PublicUserInfo } from '@casual-simulation/aux-common/common';

interface PublicUserInfo {
    userId: string; // User ID
    name: string; // User name
    displayName: string | null; // Display name (if set)
    email?: string; // Email (optional)
}
```

### WebManifest (`WebManifest.ts`)

Web manifest types for Progressive Web App configuration (exported types from this module).

## Usage Examples

### Remote Action Communication

```typescript
import {
    RemoteAction,
    DeviceAction,
    remoteResult,
    remoteError,
} from '@casual-simulation/aux-common/common';

// Client A: Send action to Client B
const action: RemoteAction = {
    type: 'remote',
    userId: 'userB',
    event: {
        type: 'game_move',
        position: { x: 10, y: 20 },
    },
    taskId: 'task123',
};

// Client B: Receive action
function handleDeviceAction(action: DeviceAction) {
    console.log(`Received from ${action.connection.userId}`);
    console.log(`Event:`, action.event);

    // Send result back
    return remoteResult(action.connection, action.taskId, {
        success: true,
    });
}

// Handle errors
function handleError(err: Error) {
    return remoteError(connection, taskId, err.message);
}
```

### Connection Management

```typescript
import {
    ConnectionInfo,
    ConnectionIndicator,
    getConnectionId,
    formatV1ConnectionToken,
} from '@casual-simulation/aux-common/common';

// Create connection token
const token = formatV1ConnectionToken(
    'user123',
    'session456',
    'conn789',
    'mainRecord',
    'inst001',
    'securityHash'
);

// Use token to create connection indicator
const indicator: ConnectionIndicator = {
    connectionToken: token,
};

// Extract connection ID
const connId = getConnectionId(indicator);

// Track connection info
const info: ConnectionInfo = {
    userId: 'user123',
    sessionId: 'session456',
    connectionId: connId,
};
```

### Permission Checking

```typescript
import {
    PolicyPermissions,
    DenialReason,
    DATA_RESOURCE_KIND,
    READ_ACTION,
} from '@casual-simulation/aux-common/common';

function checkPermission(
    userId: string,
    resourceId: string
): DenialReason | null {
    // Check if user has permission
    if (!hasPermission(userId, DATA_RESOURCE_KIND, READ_ACTION, resourceId)) {
        return {
            type: 'missing_permission',
            recordName: 'myRecord',
            subjectType: 'user',
            subjectId: userId,
            resourceKind: DATA_RESOURCE_KIND,
            action: READ_ACTION,
            resourceId: resourceId,
        };
    }

    return null; // Permission granted
}
```

### Status Updates

```typescript
import {
    StatusUpdate,
    ProgressMessage,
} from '@casual-simulation/aux-common/common';

function sendStatusUpdate(update: StatusUpdate) {
    switch (update.type) {
        case 'connection':
            console.log(
                `Connection: ${update.connected ? 'Connected' : 'Disconnected'}`
            );
            break;

        case 'authentication':
            if (update.authenticated) {
                console.log(`Authenticated as ${update.info.userId}`);
            } else {
                console.error(`Auth failed: ${update.reason}`);
            }
            break;

        case 'progress':
            console.log(
                `${update.message} ${Math.round(update.progress * 100)}%`
            );
            if (update.done) {
                console.log('Loading complete!');
            }
            break;
    }
}
```

### Version Management

```typescript
import {
    parseVersionNumber,
    formatVersionNumber,
} from '@casual-simulation/aux-common/common';

// Parse current version
const current = parseVersionNumber('v1.5.3');
const target = parseVersionNumber('v2.0.0-beta.1');

// Compare versions
if (current.major < target.major) {
    console.log('Major version upgrade available');
}

// Check for alpha/beta versions
if (target.alpha) {
    console.log('This is a pre-release version');
}

// Format version for display
const displayVersion = formatVersionNumber(
    current.major,
    current.minor,
    current.patch,
    current.tag || ''
);
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Common Module                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │    Action    │──────│RemoteActions │                    │
│  │  (Base Type) │      │ (Device Comm)│                    │
│  └──────────────┘      └──────────────┘                    │
│         │                      │                            │
│         │                      ▼                            │
│         │              ┌──────────────┐                     │
│         │              │ ConnectionInfo│                    │
│         │              │ConnectionToken│                    │
│         │              └──────────────┘                     │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │StatusUpdate  │──────│LoadingProgress│                   │
│  │ (Connection, │      │  (Callbacks) │                    │
│  │  Auth, Sync) │      └──────────────┘                    │
│  └──────────────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────┐                      │
│  │      PolicyPermissions           │                      │
│  │  (1700+ lines of auth types)     │                      │
│  │   - SubjectType                  │                      │
│  │   - ResourceKinds (20+ types)    │                      │
│  │   - ActionKinds (20+ types)      │                      │
│  └──────────────────────────────────┘                      │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │DenialReason  │──────│PrivacyFeatures│                   │
│  │ (Auth Errors)│      │  (User Prefs) │                   │
│  └──────────────┘      └──────────────┘                    │
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │  WebConfig   │──────│   Version    │                    │
│  │(Client Config)│     │  (Parsing)   │                    │
│  └──────────────┘      └──────────────┘                    │
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │  Iterators   │──────│PublicUserInfo│                    │
│  │  (Helpers)   │      │  (User Data) │                    │
│  └──────────────┘      └──────────────┘                    │
│                                                             │
└──────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Action System

All operations in CasualOS are represented as actions with a `type` field. The `Action` interface is the base for all events:

-   Bot operations extend `Action`
-   Remote communication uses `RemoteAction`
-   Device messages use `DeviceAction`
-   Results use `RemoteActionResult` or `RemoteActionError`

### Connection Management

Connections are tracked through multiple layers:

-   **ConnectionInfo**: Identifies a specific connection (userId, sessionId, connectionId)
-   **ConnectionToken**: Secure token encoding connection details
-   **ConnectionIndicator**: Either a token or direct ID for establishing connections

### Authorization Flow

1. **Subject** (user/inst/role) attempts **Action** on **Resource**
2. System checks **PolicyPermissions** for that combination
3. If denied, returns **DenialReason** with details
4. **PrivacyFeatures** may additionally restrict access

### Status Communication

Status updates flow through multiple channels:

-   Connection state changes
-   Authentication/authorization results
-   Synchronization progress
-   Loading progress (0.0 to 1.0)
-   Console messages (log/warn/error)

## Dependencies

This module depends on:

-   `zod`: Schema validation for remote actions and configuration
-   `@casual-simulation/aux-common/bots`: For `hasValue` utility
-   `@casual-simulation/aux-common/utils`: For base64 encoding/decoding
-   `@casual-simulation/aux-common/partitions`: For partition protocol types
-   `@casual-simulation/aux-common/websockets`: For WebSocket error types

## Integration Points

The common module integrates with:

-   **aux-runtime**: Uses Action types for bot operations
-   **aux-vm**: Uses RemoteActions for cross-VM communication
-   **aux-records**: Uses PolicyPermissions for authorization
-   **aux-websocket**: Uses ConnectionInfo and StatusUpdate
-   **aux-web**: Uses WebConfig for client configuration
-   **aux-server**: Uses all types for complete backend API

## Related Packages

-   `@casual-simulation/aux-common/bots`: Bot system that uses Action types
-   `@casual-simulation/aux-common/partitions`: Partition system using connection types
-   `@casual-simulation/aux-records`: Backend using permissions and configuration
-   `@casual-simulation/aux-websocket`: WebSocket layer using connection management
