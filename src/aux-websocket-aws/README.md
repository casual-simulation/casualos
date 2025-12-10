# @casual-simulation/aux-websocket-aws

AWS API Gateway WebSocket integration layer for CasualOS (AUX) services, providing specialized handling for AWS API Gateway's WebSocket message size limitations.

## Overview

This package provides a WebSocket client specifically designed for connecting to CasualOS (AUX) services hosted on AWS API Gateway. It extends the standard WebSocket protocol with automatic large message handling through S3 upload/download mechanisms, working around AWS API Gateway's 32KB message size limit.

## Main Export

### `ApiGatewayWebsocketConnectionClient`

A specialized WebSocket client that implements the `ConnectionClient` interface with AWS API Gateway-specific features, particularly automatic handling of large messages through S3 presigned URLs.

**Features:**

-   **Automatic Large Message Handling**: Messages exceeding 32KB are automatically uploaded to S3 via presigned URLs
-   **Message Size Detection**: Automatically detects when messages exceed AWS API Gateway limits
-   **Upload/Download Protocol**: Implements a custom protocol for transferring large messages via HTTP
-   **Transparent to Application**: Large message handling is completely transparent to the application layer
-   **Connection State Management**: Full connection state tracking via RxJS observables
-   **Error Handling**: Dedicated error stream for connection and protocol errors
-   **Type-Safe**: Built with TypeScript for full type safety

**Key Methods:**

-   `connect()` - Establish WebSocket connection to AWS API Gateway
-   `disconnect()` - Close WebSocket connection
-   `send(message)` - Send a message (automatically handles large messages)
-   `event<T>(name)` - Subscribe to specific event types
-   `connectionState` - Observable of connection state changes
-   `onError` - Observable of error events

**Usage:**

```typescript
import { ApiGatewayWebsocketConnectionClient } from '@casual-simulation/aux-websocket-aws';
import { ReconnectableSocket } from '@casual-simulation/websocket';

// Create underlying WebSocket connection to AWS API Gateway
const socket = new ReconnectableSocket(
    'wss://your-api-gateway-id.execute-api.region.amazonaws.com/stage'
);

// Create AWS API Gateway-aware client
const client = new ApiGatewayWebsocketConnectionClient(socket);

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

// Small messages sent directly through WebSocket
client.send({
    type: 'login',
    data: { userId: '123' },
});

// Large messages automatically handled via S3
client.send({
    type: 'largeData',
    payload: veryLargeDataObject, // Automatically uploaded to S3
});
```

## Large Message Handling

When a message exceeds the `MAX_MESSAGE_SIZE` (32KB), the client automatically:

1. **Requests Upload URL**: Sends an upload request to the server
2. **Receives Presigned URL**: Server responds with S3 presigned URL
3. **Uploads to S3**: Client uploads message data to S3 via HTTP
4. **Requests Download**: Client notifies server of S3 location
5. **Server Downloads**: Server downloads from S3 and processes message

This entire process is transparent to the application - just call `send()` with any size message.

## Message Size Limit

```typescript
MAX_MESSAGE_SIZE = 32_000 bytes (32KB)
```

Messages larger than this threshold trigger the automatic upload/download protocol.

## WebSocket Event Protocol

The client implements an extended WebSocket event protocol:

-   `WebsocketEventTypes.Message` - Standard message event
-   `WebsocketEventTypes.UploadRequest` - Request S3 upload URL
-   `WebsocketEventTypes.UploadResponse` - Receive S3 upload URL
-   `WebsocketEventTypes.DownloadRequest` - Request download from S3
-   `WebsocketEventTypes.Error` - Error event

## Dependencies

-   **@casual-simulation/websocket**: Low-level WebSocket management
-   **@casual-simulation/aux-common**: AUX common types and interfaces
-   **axios**: HTTP client for S3 uploads/downloads
-   **rxjs**: Observable-based event handling

## Installation

```bash
npm install @casual-simulation/aux-websocket-aws
```

## When to Use This Package

Use this package when:

-   Connecting to CasualOS services hosted on AWS API Gateway
-   You need to send messages that may exceed 32KB
-   You want transparent large message handling

Use `@casual-simulation/aux-websocket` instead when:

-   Connecting to non-AWS WebSocket endpoints
-   All messages are guaranteed to be under 32KB
-   You don't need AWS-specific features
