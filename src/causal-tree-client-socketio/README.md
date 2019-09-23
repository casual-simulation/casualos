# Causal Tree Client Socket.io

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/causal-tree-client-socketio.svg)](https://www.npmjs.com/package/@casual-simulation/causal-tree-client-socketio)

A set of services that can be used to network with `@casual-simulation/causal-tree-server-socketio`.

## Usage

#### Connect to a server

```typescript
import {
    SocketManager,
    CausalTreeManager,
} from '@casual-simulation/causal-tree-client-socketio';
import {
    CausalTreeFactory,
    NullCausalTreeStore,
} from '@casual-simulation/causal-trees';

demo();

async function demo() {
    const socket = new SocketManager('https://example.com');
    const manager = new CausalTreeManager(
        socket,
        new CausalTreeFactory({
            test: (stored, options) =>
                new CausalTree<any, any, any>(stored, new MyReducer(), options),
        }),
        new NullCausalTreeStore()
    );

    socket.init();
    await manager.init();

    const syncedTree = await manager.getTree<CausalTree<any, any, any>>({
        id: 'example',
        type: 'test',
    });

    // TODO: Do things with the SyncedRealtimeCausalTree
}
```
