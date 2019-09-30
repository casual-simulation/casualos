# AUX VM Client

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/aux-vm-client.svg)](https://www.npmjs.com/package/@casual-simulation/aux-vm-client)

A set of utilities required to run an AUX as a client.

## Installation

```
npm install @casual-simulation/aux-vm-client
```

## Usage

#### Create a custom channel implementation

```javascript
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client';
import { AuxUser, AuxConfig } from '@casual-simulation/aux-vm';

export class MyCustomChannel extends RemoteAuxChannel {

    constructor(defaultHost: string, user: AuxUser, config: AuxConfig) {
        super(defaultHost, user, config, {});
    }

    // Override the _handleServerEvents function
    // to handle events sent from a remote device.
    protected async _handleServerEvents(events: DeviceAction[]) {
        await super._handleServerEvents(events);
        let filtered = events.filter(
            e => e.device.roles.indexOf(SERVER_ROLE) >= 0
        );
        let mapped = <BotAction[]>filtered.map(e => e.event);
        if (filtered.length > 0) {
            await this.sendEvents(mapped);
        }
    }
}
```
