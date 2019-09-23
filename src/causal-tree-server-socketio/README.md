# Causal Tree Server Socket.io

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/causal-tree-server-socketio.svg)](https://www.npmjs.com/package/@casual-simulation/causal-tree-server-socketio)

Casual trees served over socket.io.

## Installation

```
npm install @casual-simulation/causal-tree-server-socketio
```

## Usage

#### Start a Causal Tree Server

```typescript
import * as Http from 'http';
import SocketIO from 'socket.io';
import { MongoClient } from 'mongodb';
import { CausalTreeServerSocketIO } from '@casual-simulation/causal-tree-server-socketio';
import { CausalTreeStoreMongoDB } from '@casual-simulation/causal-tree-store-mongodb';
import { DeviceManagerImpl, ChannelManagerImpl, NullDeviceAuthenticator, NullChannelAuthorizer } from '@casual-simulation/causal-tree-server';
import { CausalTreeFactory, CausalTree } from '@casual-simulation/causal-trees';

demo();

async function demo() {

    // Setup the HTTP server and Socket.io Server.
    const http = new Http.Server();
    const socket = SocketIO(this._http);

    // The claims and roles that the server
    // should have.
    // This is like a user except it bypasses authentication
    // and role lookup and just lets the server act like it
    // has the given claims and roles.
    const serverDevice: DeviceInfo = {
        claims: {
            [USERNAME_CLAIM]: 'server',
            [DEVICE_ID_CLAIM]: 'server',
            [SESSION_ID_CLAIM]: 'server',
        },
        roles: [SERVER_ROLE],
    };

    // The factory that should be used to create causal trees
    // from stored data.
    const causalTreeFactory = new CausalTreeFactory({
        test: (stored, options) => new CausalTree<any, any, any>(stored, new MyReducer(), options)
    });

    // Connect to MongoDB
    MongoClient.connect('mongodb://my_mongo_db:27017' async (client) => {

        // Load and store data in MongoDB
        const causalTreeStore = new CausalTreeStoreMongoDB(client, 'myDB');
        await causalTreeStore.init();

        // Setup the channel manager
        const channelManager = new ChannelManagerImpl(
            causalTreeStore,
            causalTreeFactory
        );

        // Setup the device manager
        const deviceManager = new DeviceManagerImpl();

        // Create a causal tree server with the following services.
        const server = new CausalTreeServerSocketIO(
            serverDevice,
            socket,
            deviceManager,
            channelManager,

            // Allow any connection to be any user
            new NullDeviceAuthenticator(),

            // Allow any user to connect to any channel
            new NullChannelAuthorizer()
        );

        // Listen for connections on port 3000
        http.listen(3000);
    });
}

```
