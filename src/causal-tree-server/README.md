# Causal Tree Server

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/causal-tree-server.svg)](https://www.npmjs.com/package/@casual-simulation/causal-tree-server)

A library that makes serving causal trees easier.

## Installation

```
npm install @casual-simulation/causal-tree-server
```

## Usage

#### Create a device manager

The `DeviceManager` helps manage realtime connections and allows executing custom logic per connection.

```typescript
import { DeviceManagerImpl } from '@casual-simulation/causal-tree-server';
import { Subscription } from 'rxjs';

demo();

async function demo() {
    const manager = new DeviceManagerImpl();

    // Register a listener which is called
    // whenever a device joins a channel.
    manager.whenConnectedToChannel((device, channel) => {
        console.log('Device ', device.id, ' joined channel ', channel.info.id);
        console.log(device.extra);

        // return a list of subscriptions that should be disposed
        // when the device leaves the channel
        return [
            new Subscription(() => {
                console.log(
                    'Device ',
                    device.id,
                    ' left channel ',
                    channel.info.id
                );
            }),
        ];
    });

    // Register that a device with ID 'deviceId'
    // was connected.
    const device = await manager.connectDevice('deviceId', {
        extraInfo: 'abc',
    });

    // Join the device to a channel
    const connection = await manager.joinChannel(device, {
        id: 'channel',
        type: 'aux',
    });

    // Disconnect the device
    await manager.disconnectDevice(device);
}
```

#### Create a channel manager

The `ChannelManager` helps manage active channels and allows executing custom logic per channel.

```typescript
import {
    NullCausalTreeStore,
    CausalTreeFactory,
    CausalTree,
} from '@casual-simulation/causal-trees';
import { ChannelManagerImpl } from '@casual-simulation/causal-tree-server';
import { NodeSigningCryptoImpl } from '@casual-simulation/crypto-node';

demo();

async function demo() {
    const manager = new ChannelManagerImpl(
        new NullCausalTreeStore(),
        new CausalTreeFactory({
            test: (stored, options) =>
                new CausalTree<any, any, any>(stored, options),
        }),
        new NodeSigningCryptoImpl('ECDSA-SHA256-NISTP256')
    );

    // Register a listener which is called
    // whenever a device joins a channel.
    manager.whileCausalTreeLoaded((tree, info) => {
        console.log('Causal tree loaded: ', info.id);

        // return a subscription that should be disposed
        // when the device leaves the channel
        return [];
    });

    // Load a channel
    const channel = await manager.loadChannel({
        id: 'example',
        type: 'test',
    });

    console.log('Loaded channel: ', channel.info.id);

    // TODO: Do something with the loaded tree
}
```
