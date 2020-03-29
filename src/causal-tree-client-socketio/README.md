# Causal Tree Client Socket.io

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/causal-tree-client-socketio.svg)](https://www.npmjs.com/package/@casual-simulation/causal-tree-client-socketio)

A connection transport for a CausalRepoClient that uses socket.io to communicate with a SocketIOConnectionServer from `@casual-simulation/causal-tree-server-socketio`.

## Usage

#### Connect to a server

```typescript
import {
    SocketManager,
    SocketIOConnectionClient,
} from '@casual-simulation/causal-tree-client-socketio';

demo();

async function demo() {
    const manager = new SocketManager('https://example.com');
    const connection = new SocketIOConnectionClient(manager.socket, {
        id: 'device-id',
        username: 'username',
        token: 'token',
    });

    manager.init();
    connection.connect();

    // TODO: Do things with the connection
}
```
