# Channels Core

The core channels library. Contains common services and utilities for JavaScript/TypeScript (node.js and browser) projects.

## Usage

Simply `npm install` this project:

```
> npm install my/path/to/channels-core
```

Then import the services you need from your TypeScript file:

```typescript

import { ChannelClient } from 'channels-core';

// Use it
```

Channels are very simple in nature - they're just a pipeline of events which feed into a "state store".
Channels work across the network and has an easily pluggable architecture so you can support whichever protocols you want.

The basic idea goes like this:

```typescript
import * as io from 'socket.io-client';

import { ChannelClient, StoreFactory } from 'channels-core';
import { SocketIOConnector } from 'channels-client';
import { CalculatorStateStore } from './CalculatorStateStore';

// "Stores" in channels are simply places where we decide to keep our application state.
// In a chat application, for example, the state stores recent messages and other things like which users
// are currently typing.

// "Store factories" are just what they say they are. They create stores for channels.
// The default store factory (simply named "StoreFactory") simply maps channel types to stores.

// In this case, we're mapping the "calculator" channel type to
// new instances of the CalculatorStateStore.
let storeFactory = new StoreFactory({
    calculator: () => new CalculatorStateStore()
});

// "Connectors" in channels are services which help create channels.
// In particular, connectors are in charge of configuring the network side of a channel.

// Channels are by nature serverless. The client has no concept of a server, it only knows a few things:
//   - Channel IDs, Names, Types.
//   - The state of the channel when we connected.
//   - What events arrive on the channel after we have connected to it.
// This means that when using a protocol which requires a server, a little extra setup is needed.
// In this case, we're running the Socket.io connector which requires that the corresponding
// SocketIOChannelServer from the 'channel-server' library is running at the given address.
let socket = io.connect('http://localhost:3000');
let connector = new SocketIOConnector(socket);

// Now we can create our channel client from the two services we have created.
// Channel clients are actually pretty simple. They really only compose channel connectors
// and store factories together to make creating channels less tedious.
let client = new ChannelClient(connector, storeFactory);

// Now we can get a reference to a channel.
// When we first get a channel reference, nothing actually happens.
// We're simply grabbing a convienent handle that encapsulates the basic
// information needed to distinguish this particular channel from other
// channels that our "Connector" might want to connect to.

// Of note is the channel ID, name, and type.
// The type is often used by the StoreFactory to determine which
// state store to create while the ID is used by the connector to determine
// what network connections to make.
let channel = client.getChannel<number>({
    id: 'calculator-channel',
    type: 'calculator',
    name: 'Realtime Calculator'
});

// Once we have a channel referece, we can subscribe to it to get continual updates.
// subscribe() returns a promise which resolves with a "Channel Connection".
// As you can probably guess, connections represent active listening and participation
// on a channel.
channel.subscribe().then(connection => {
    
    // This is the info about the channel.
    // Usually just what we entered above when we got our channel
    // reference.
    let info = connection.info;

    // This is the state store that the store factory
    // above created for the channel.
    let store = connection.store;

    // The observable list of events that the channel has.
    // This list is realtime so you'll want to subscribe to it
    // as soon as possible to make sure you don't miss any events.
    let events = connection.events;

    // The emit function sends events through the channel to other clients.
    // Note that events emitted this way will appear on the connection.events
    // observable.
    connection.emit({
        type: 'add',
        creation_time: new Date(),
        left: 2,
        right: 2
    });

    // Unsubscribes from the channel.
    // This prevents future events from being recieved on the channel.
    connection.unsubscribe();
});
```

## Development

### Setup

1. Make sure you have the latest Node.js `8.x` LTS installed.
2. Open a terminal to this folder.
3. Run `npm install`

### Testing

Because this is a library, the most direct way to test this project is via unit tests.
These are the `file.spec.ts` files in the `src` directory. 
Everything is already setup so when a new `*.spec.ts` file is added, it will automatically be picked up by the test runner.

To run the tests, use the usual NPM test incantation:

```
> npm test
```