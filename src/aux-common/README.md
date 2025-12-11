# @casual-simulation/aux-common

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/aux-common.svg)](https://www.npmjs.com/package/@casual-simulation/aux-common)

Core shared library for CasualOS (formerly AUX). This package provides foundational types, utilities, and infrastructure used across all CasualOS components.

## Overview

`aux-common` is the foundation of the CasualOS platform, containing:

-   **Bot System**: Core bot state management, calculations, actions, and events
-   **Partitions**: Pluggable storage backends for bot state (memory, Yjs CRDT, remote sync)
-   **WebSockets**: Real-time communication infrastructure for multi-user collaboration
-   **RPC Framework**: Type-safe remote procedure calls with comprehensive error handling
-   **Documents**: Collaborative document abstractions using Yjs CRDTs
-   **Math Utilities**: Vector, quaternion, and rotation classes for 3D graphics
-   **Common Types**: Actions, events, connections, permissions, and versioning
-   **Records**: Data record management and WebPush notifications
-   **Forms**: Form validation and error handling
-   **State Machines**: State machine abstractions for complex workflows
-   **Yjs Utilities**: Helper functions and IndexedDB persistence for CRDTs

## Installation

```bash
npm install @casual-simulation/aux-common
```

## Package Structure

```
aux-common/
├── bots/              # Core bot system (RuntimeBot, actions, events, calculations)
├── partitions/        # Storage backends (Memory, Yjs, Remote, OtherPlayers)
├── websockets/        # WebSocket clients and inst records protocol
├── common/            # Shared types (actions, connections, versioning)
├── rpc/               # Type-safe RPC framework with error codes
├── documents/         # Collaborative document abstractions (Yjs)
├── math/              # Vector2/3, Quaternion, Rotation classes
├── records/           # Data records and WebPush notifications
├── yjs/               # Yjs helper functions and IndexedDB persistence
├── http/              # HTTP interface types
├── forms/             # Form validation and errors
├── state-machine/     # State machine abstractions
├── polyfill/          # Browser polyfills
├── utils.ts           # General utility functions
├── Errors.ts          # Error types and handling
├── Event.ts           # Event system
└── AppVersion.ts      # Version management
```

## Core Modules

### Bots (`bots/`)

The bot system is the heart of CasualOS, representing interactive objects with tags and behaviors.

**Key Exports**:

-   `RuntimeBot`: Core bot interface with tags and state
-   `BotActions`: Actions for creating, updating, and removing bots
-   `BotCalculations`: Calculate bot properties (positions, rotations, colors)
-   `BotEvents`: Event types (onClick, onCombine, onDrag, etc.)
-   `BotIndex`: Fast lookup tables for bot queries
-   `StateUpdatedEvent`: Bot state change events

**Example**:

```typescript
import {
    createBot,
    botAdded,
    calculateBotValue,
} from '@casual-simulation/aux-common';

const bot = createBot('player1', {
    name: 'Alice',
    position: { x: 0, y: 0, z: 0 },
    color: '#ff0000',
});

const name = calculateBotValue(null, bot, 'name'); // "Alice"
```

[See bots/README.md for detailed documentation](bots/README.md)

### Partitions (`partitions/`)

Partitions provide pluggable storage backends for bot state, enabling different persistence and synchronization strategies.

**Key Exports**:

-   `AuxPartition`: Base partition interface
-   `MemoryPartition`: In-memory storage (fast, volatile)
-   `YjsPartition`: Local Yjs CRDT with IndexedDB persistence
-   `RemoteYjsPartition`: Networked Yjs with server synchronization
-   `OtherPlayersPartition`: Multi-user player state aggregation
-   `PartitionAuthSource`: Authentication coordination

**Example**:

```typescript
import { createMemoryPartition } from '@casual-simulation/aux-common';

const partition = createMemoryPartition({
    type: 'memory',
    initialState: {},
});

partition.onBotsAdded.subscribe((bots) => {
    console.log('Bots added:', bots);
});
```

[See partitions/README.md for detailed documentation](partitions/README.md)

### WebSockets (`websockets/`)

WebSocket infrastructure for real-time communication and inst records synchronization.

**Key Exports**:

-   `ConnectionClient`: Base WebSocket client interface
-   `AuthenticatedConnectionClient`: Authentication wrapper
-   `InstRecordsClient`: Inst records protocol (branch watching, updates, device actions)
-   `WebsocketEvents`: Complete protocol message types
-   `MemoryConnectionClient`: In-memory client for testing

**Example**:

```typescript
import { InstRecordsClient } from '@casual-simulation/aux-common';

const instClient = new InstRecordsClient(connectionClient);

const updates$ = instClient.watchBranchUpdates({
    recordName: 'myRecord',
    inst: 'myInst',
    branch: 'main',
});

updates$.subscribe((event) => {
    if (event.type === 'updates') {
        console.log('Received updates:', event.updates);
    }
});
```

[See websockets/README.md for detailed documentation](websockets/README.md)

### Common (`common/`)

Foundational types and utilities used throughout CasualOS.

**Key Exports**:

-   `Action`: Base action type
-   `RemoteActions`: Device actions and results
-   `ConnectionInfo`: Connection metadata
-   `ConnectionIndicator`: Connection tokens and credentials
-   `CurrentVersion`: Version vectors for synchronization
-   `StatusUpdate`: Progress and status messages
-   `DenialReason`: Permission denial reasons

**Example**:

```typescript
import type {
    Action,
    ConnectionInfo,
    CurrentVersion,
} from '@casual-simulation/aux-common';

const action: Action = {
    type: 'show_toast',
    message: 'Hello, world!',
};
```

[See common/README.md for detailed documentation](common/README.md)

### RPC (`rpc/`)

Type-safe remote procedure call framework with comprehensive error handling.

**Key Exports**:

-   `RPCResult`: Result types (success/error)
-   `ErrorCodes`: 100+ standardized error codes
-   `RPCError`: Error type with code and message
-   Procedure types: `GetAccountInfoProcedure`, `CreateRecordProcedure`, etc.

**Example**:

```typescript
import type { GetAccountInfoProcedure } from '@casual-simulation/aux-common';

const result = await client.call('getAccountInfo', {});

if (result.success) {
    console.log('User:', result.data.user);
} else {
    console.error('Error:', result.errorCode, result.errorMessage);
}
```

### Documents (`documents/`)

Collaborative document abstractions using Yjs CRDTs.

**Key Exports**:

-   `YjsSharedDocument`: Local Yjs document with persistence
-   `RemoteYjsSharedDocument`: Networked Yjs with server sync
-   `SharedMap`, `SharedArray`, `SharedText`: Collaborative data structures

**Example**:

```typescript
import { YjsSharedDocument } from '@casual-simulation/aux-common';

const doc = new YjsSharedDocument({
    type: 'yjs',
    branch: 'my-doc',
});

const map = doc.getMap('data');
map.set('key', 'value');
```

[See documents/README.md for detailed documentation](documents/README.md)

### Math (`math/`)

Vector, quaternion, and rotation classes for 3D graphics and spatial calculations.

**Key Exports**:

-   `Vector2`: 2D vectors with arithmetic and geometric operations
-   `Vector3`: 3D vectors with cross product and direction constants
-   `Quaternion`: Quaternion representation of rotations
-   `Rotation`: High-level rotation interface with multiple construction methods

**Example**:

```typescript
import { Vector3, Rotation } from '@casual-simulation/aux-common';

const position = new Vector3(1, 2, 3);
const direction = position.normalize();

const rotation = new Rotation({
    axis: new Vector3(0, 0, 1),
    angle: Math.PI / 2,
});
```

[See math/README.md for detailed documentation](math/README.md)

### Yjs (`yjs/`)

Yjs utilities and IndexedDB persistence for CRDTs.

**Key Exports**:

-   `YjsIndexedDBPersistence`: Local storage with automatic trimming
-   `getStateVector`: Get version vector from Yjs document
-   `createRelativePositionFromStateVector`: CRDT-safe positions
-   `getTextChar`: Character-level text access

**Example**:

```typescript
import {
    YjsIndexedDBPersistence,
    getStateVector,
} from '@casual-simulation/aux-common';
import * as Y from 'yjs';

const doc = new Y.Doc();
const persistence = new YjsIndexedDBPersistence('my-doc', doc);

await persistence.whenSynced;
console.log('Document loaded from IndexedDB');

const stateVector = getStateVector(doc);
console.log('State:', stateVector);
```

[See yjs/README.md for detailed documentation](yjs/README.md)

## Usage Examples

### Basic Bot Management

```typescript
import {
    createBot,
    botAdded,
    botUpdated,
    createMemoryPartition,
} from '@casual-simulation/aux-common';

// Create partition
const partition = createMemoryPartition({
    type: 'memory',
    initialState: {},
});

// Add bot
await partition.applyEvents([
    botAdded(
        createBot('bot1', {
            name: 'My Bot',
            color: '#ff0000',
        })
    ),
]);

// Update bot
await partition.applyEvents([
    botUpdated('bot1', {
        tags: { color: '#00ff00' },
    }),
]);

// Subscribe to changes
partition.onBotsUpdated.subscribe((updates) => {
    console.log('Bots updated:', updates);
});
```

### Calculate Bot Formulas

```typescript
import {
    createBot,
    createCalculationContext,
    calculateFormulaValue,
} from '@casual-simulation/aux-common';

const bot1 = createBot('test1', {
    quantity: 10,
});
const bot2 = createBot('test2', {
    quantity: 5,
});
const bot3 = createBot('test3', {
    quantity: 5,
});

const context = createCalculationContext([bot1, bot2, bot3]);

const formula = '=math.sum(getBotTagValues("#quantity"))';
const result = calculateFormulaValue(context, formula);

console.log(result); // 20
```

### Calculate Action Events

```typescript
import {
    createBot,
    calculateFormulaEvents,
} from '@casual-simulation/aux-common';

const state = {
    test1: createBot('test1', { quantity: 10 }),
    test2: createBot('test2', { quantity: 5 }),
    test3: createBot('test3', { quantity: 5 }),
};

const formula = `
    let total = math.sum(getBotTagValues("#quantity"));
    player.toast("The total is " + total);
`;
const events = calculateFormulaEvents(state, formula);

for (let event of events) {
    if (event.type === 'local') {
        if (event.name === 'show_toast') {
            console.log('[Toast]', event.message);
        }
    }
}
// Outputs: [Toast] The total is 20
```

### Real-Time Collaboration

```typescript
import {
    InstRecordsClient,
    AuthenticatedConnectionClient,
    createRemoteClientYjsPartition,
} from '@casual-simulation/aux-common';

// Set up connection
const authClient = new AuthenticatedConnectionClient(baseClient, authSource);
const instClient = new InstRecordsClient(authClient);

// Create remote partition
const partition = await createRemoteClientYjsPartition(
    {
        type: 'yjs_client',
        client: instClient,
        recordName: 'project',
        inst: 'workspace',
        branch: 'main',
    },
    authSource
);

partition.connect();

// Watch for updates
partition.onBotsAdded.subscribe((bots) => {
    console.log('Bots added:', bots);
});
```

### 3D Calculations

```typescript
import {
    Vector3,
    Rotation,
    calculateBotValue,
} from '@casual-simulation/aux-common';

const bot = createBot('player', {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: Math.PI / 4 },
});

const position = calculateBotValue(null, bot, 'position') as Vector3;
const rotation = calculateBotValue(null, bot, 'rotation') as Rotation;

const forward = new Vector3(0, 1, 0);
const worldForward = rotation.rotateVector3(forward);

const newPosition = position.add(worldForward.multiplyScalar(5));
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CasualOS                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │              Application Layer                     │   │
│  │  (aux-vm, aux-runtime, aux-web, casualos-cli)     │   │
│  └────────────────────┬───────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼───────────────────────────────┐   │
│  │              @casual-simulation/aux-common         │   │
│  ├────────────────────────────────────────────────────┤   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │   │
│  │  │   Bots   │  │Partitions │  │  WebSockets  │  │   │
│  │  │          │  │           │  │              │  │   │
│  │  │ Actions  │  │  Memory   │  │ InstRecords  │  │   │
│  │  │ Events   │  │  Yjs      │  │ Connection   │  │   │
│  │  │ Calcs    │  │  Remote   │  │ Auth         │  │   │
│  │  └──────────┘  └───────────┘  └──────────────┘  │   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │   │
│  │  │   RPC    │  │ Documents │  │     Math     │  │   │
│  │  │          │  │           │  │              │  │   │
│  │  │ Errors   │  │ SharedMap │  │ Vector2/3    │  │   │
│  │  │ Results  │  │ SharedText│  │ Quaternion   │  │   │
│  │  │ Procs    │  │ Yjs CRDT  │  │ Rotation     │  │   │
│  │  └──────────┘  └───────────┘  └──────────────┘  │   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │   │
│  │  │  Common  │  │    Yjs    │  │   Records    │  │   │
│  │  │          │  │           │  │              │  │   │
│  │  │ Actions  │  │ Helpers   │  │  WebPush     │  │   │
│  │  │ Connect  │  │ IndexedDB │  │  Policies    │  │   │
│  │  │ Versions │  │ Persist   │  │  Schemas     │  │   │
│  │  └──────────┘  └───────────┘  └──────────────┘  │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Bot-Centric Architecture

CasualOS uses a bot-centric model where everything is a bot with tags:

-   **Bots**: Objects with ID and tags (key-value pairs)
-   **Tags**: Properties that define bot behavior and appearance
-   **Actions**: Events that modify bot state
-   **Calculations**: Compute derived properties from tags

### Partition-Based Storage

Storage is abstracted through partitions:

-   **Memory**: Fast, volatile in-memory storage
-   **Yjs**: Local CRDT with IndexedDB persistence
-   **Remote**: Networked CRDT with server synchronization
-   **OtherPlayers**: Multi-user player state aggregation

### Real-Time Collaboration

Multi-user collaboration via:

-   **Yjs CRDTs**: Conflict-free replicated data types
-   **WebSocket Protocol**: Inst records protocol for updates
-   **State Vectors**: Track document versions
-   **Operational Transforms**: Apply edits at specific versions

### Type-Safe Communication

Type safety across the stack:

-   **RPC Framework**: Type-safe remote procedures
-   **Zod Schemas**: Runtime validation
-   **Error Codes**: Standardized error handling
-   **Observable Streams**: RxJS for reactive programming

## License

AGPL-3.0-only

## Related Packages

-   `@casual-simulation/aux-runtime`: Runtime execution engine
-   `@casual-simulation/aux-vm`: Virtual machine implementations
-   `@casual-simulation/aux-web`: Web application UI
-   `@casual-simulation/aux-records`: Server-side record management
-   `@casual-simulation/casualos-cli`: Command-line interface

## Contributing

See [DEVELOPERS.md](../../DEVELOPERS.md) for development guidelines.

## Version

Current version: 3.8.1

See [CHANGELOG.md](../../CHANGELOG.md) for version history
