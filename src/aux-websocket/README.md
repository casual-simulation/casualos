# @casual-simulation/aux-websocket

WebSocket integration layer for CasualOS (AUX) services, providing a high-level client for real-time communication with AUX servers.

## Overview

This package provides a WebSocket-based connection client specifically designed for communicating with CasualOS (AUX) services. It builds on top of `@casual-simulation/websocket` to provide a protocol-aware client with automatic message serialization, event filtering, and connection state management.

## Main Export

### `WebsocketConnectionClient`

A WebSocket client implementation that conforms to the `ConnectionClient` interface from `@casual-simulation/aux-common`. It provides structured communication with AUX services using a standardized message protocol.

**Features:**

-   **Protocol-Aware**: Implements the AUX WebSocket message protocol with automatic JSON serialization
-   **Event Filtering**: Subscribe to specific event types using the `event()` method
-   **Connection State Management**: Track connection status via RxJS observables
-   **Error Handling**: Dedicated error stream for handling connection and protocol errors
-   **Request Tracking**: Automatic request ID assignment for message correlation
-   **Type-Safe**: Built with TypeScript for full type safety

**Key Methods:**

-   `connect()` - Establish WebSocket connection
-   `disconnect()` - Close WebSocket connection
-   `send(message)` - Send a message to the server
-   `event<T>(name)` - Subscribe to specific event types
-   `connectionState` - Observable of connection state changes
-   `onError` - Observable of error events

**Usage:**

```typescript
import { WebsocketConnectionClient } from '@casual-simulation/aux-websocket';
import { ReconnectableSocket } from '@casual-simulation/websocket';

// Create underlying WebSocket
const socket = new ReconnectableSocket('wss://example.com/api/ws');

// Create AUX WebSocket client
const client = new WebsocketConnectionClient(socket);

// Listen for connection state changes
client.connectionState.subscribe((state) => {
    console.log('Connected:', state.connected);
});

// Listen for specific event types
client.event('device').subscribe((event) => {
    console.log('Device event:', event);
});

// Handle errors
client.onError.subscribe((error) => {
    console.error('WebSocket error:', error);
});

// Connect and send messages
client.connect();
client.send({
    type: 'login',
    // ... message payload
});
```

## Message Protocol

The client uses a standardized message format:

```typescript
[eventType: string, requestId: number, message: WebsocketMessage]
```

-   **eventType**: Type of the WebSocket event (e.g., 'message', 'error')
-   **requestId**: Auto-incrementing request identifier
-   **message**: The actual message payload

## Dependencies

-   **@casual-simulation/websocket**: Low-level WebSocket management
-   **@casual-simulation/aux-common**: AUX common types and interfaces
-   **rxjs**: Observable-based event handling

## Installation

```bash
npm install @casual-simulation/aux-websocket
```
