# AUX VM Browser

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/aux-vm-browser.svg)](https://www.npmjs.com/package/@casual-simulation/aux-vm-browser)

A set of utilities required to run an AUX in [Deno](https://deno.land/).

## Installation

1. Install the NPM package

```
npm install @casual-simulation/aux-vm-deno
```

2. Add the `DenoEntry.ts` file to your Webpack config:

```
entry: {
    deno: path.resolve(
        __dirname,
        'node_modules',
        '@casual-simulation',
        'aux-vm-deno',
        'DenoEntry.ts'
    ),
},
```

3. Specify a specific output filename for the `deno` bundle.

```
output: {
    filename: (pathData) => {
        return pathData.chunk.name === 'deno' ? '[name].js' : '[name].[contenthash].js';
    },
}
```

## Usage

#### Connect to an AUX

```javascript
import { BotManager } from '@casual-simulation/aux-vm-deno';
import { AuxUser } from '@casual-simulation/aux-vm';

start();

async function start() {
    // The user that we want the program to act as.
    // In a real-world scenario we would not hardcode these values
    // and we would store the token in a secure location.
    const user: AuxUser = {
        id: 'myUserId', // The Unique ID of this user session.
        username: 'myUsername', // The unique username of the user.
        name: 'myName', // The common name of the user.
        token: 'mySecretToken', // The user password.
        isGuest: false, // Whether the user should be treated as a guest.
    };

    // The ID of the channel that should be loaded.
    // The ID can have the following forms:
    // - 'channelId' - This will load 'channelId' from the current host (taken from navigator).
    // - 'https://example.com/*/channelId' - This will load 'channelId' from example.com over https
    const id = 'channelId';

    // Create a file manager.
    // This represents an in-browser AUX simulation.
    const sim = new BotManager(user, id, {
        isBuilder: false,
        isPlayer: false,
    });

    // Initialize the simulation.
    // This will setup a web worker and pipe
    // events between the worker and main thread.
    await sim.init();

    // Listen for the sync state to change to "synced".
    // When we're synced we know we have the most up to date data
    // and we can communicate our changes to the server.
    // Note that this will not fire if we are not allowed to connect.
    // This may happen if we are not authenticated/authorized.
    sim.connection.syncStateChanged.subscribe(synced => {
        if (synced) {
            console.log("We're synced!");

            // TODO: Update THE UI
        } else {
            console.log('No longer synced.');

            // TODO: Update the UI
        }
    });
}
```
