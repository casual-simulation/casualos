# @casual-simulation/websocket

A lightweight WebSocket management library that provides automatic reconnection capabilities and connection lifecycle management using RxJS observables.

## Overview

This package provides two main classes for managing WebSocket connections with built-in reconnection logic and observable-based event handling:

### `ReconnectableSocket`

A WebSocket wrapper that provides automatic reconnection capabilities and exposes connection events through RxJS observables.

**Features:**

-   Wraps native WebSocket API with observable-based event handling
-   Distinguishes between intentional disconnections and unexpected connection losses
-   Provides `onOpen`, `onClose`, `onMessage`, and `onError` observables
-   Manual control over opening and closing connections
-   Supports WebSocket protocols

**Usage:**

```typescript
const socket = new ReconnectableSocket('wss://example.com', 'protocol');

socket.onOpen.subscribe(() => {
    console.log('Connected!');
});

socket.onMessage.subscribe((event) => {
    console.log('Message received:', event.data);
});

socket.onClose.subscribe((reason) => {
    if (reason.type === 'closed') {
        console.log('Intentionally disconnected');
    } else {
        console.log('Connection lost:', reason.reason);
    }
});

socket.open();
socket.send('Hello, server!');
```

### `SocketManager`

A higher-level WebSocket connection manager that automatically handles reconnection attempts after unexpected disconnections.

**Features:**

-   Manages `ReconnectableSocket` lifecycle
-   Automatic reconnection with configurable delay (default: 5 seconds)
-   Connection state tracking via observable
-   Manual offline mode control
-   Debounced reconnection to prevent rapid retry attempts

**Usage:**

```typescript
const manager = new SocketManager('wss://example.com', 'protocol');

manager.connectionStateChanged.subscribe((connected) => {
    console.log(connected ? 'Online' : 'Offline');
});

manager.init();

// Access underlying socket
manager.socket.send('Hello!');

// Force offline mode
manager.forcedOffline = true;

// Toggle offline mode
manager.toggleForceOffline();
```

## Installation

```bash
npm install @casual-simulation/websocket
```

## Dependencies

-   **rxjs**: For observable-based event handling and stream operators
