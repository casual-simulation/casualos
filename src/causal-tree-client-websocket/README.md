# Causal Tree Client WebSocket

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/causal-tree-client-websocket.svg)](https://www.npmjs.com/package/@casual-simulation/causal-tree-client-websocket)

A connection transport for a CausalRepoClient that uses raw websockets to communicate with a WebSocketConnectionServer from `@casual-simulation/causal-tree-server-websocket`.

## Usage

#### Connect to a server

```typescript
import { SocketManager } from '@casual-simulation/websocket';
import { WebSocketConnectionClient } from '@casual-simulation/causal-tree-client-websocket';

demo();

async function demo() {
    const manager = new SocketManager('https://example.com');
    const connection = new WebSocketConnectionClient(manager.socket, {
        id: 'device-id',
        username: 'username',
        token: 'token',
    });

    manager.init();
    connection.connect();

    // TODO: Do things with the connection
}
```
