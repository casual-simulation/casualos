# AUX VM Browser

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/aux-vm-browser.svg)](https://www.npmjs.com/package/@casual-simulation/aux-vm-browser)

A set of utilities required to run an AUX in a web browser.

## Installation

1. Install the NPM package

```
npm install @casual-simulation/aux-vm-browser
```

2. Add the `WorkerEntry.js` file to your Webpack config:

```
entry: {
    vm: path.resolve(
        __dirname,
        'node_modules',
        '@casual-simulation',
        'aux-vm-browser',
        'html',
        'WorkerEntry.js'
    ),
},
```

3. Add the `iframe_host.html` file to your webpack config via the `HtmlWebpackPlugin`:

```
new HtmlWebpackPlugin({
    chunks: ['vm'],
    template: path.resolve(
        __dirname,
        'node_modules',
        '@casual-simulation',
        'aux-vm-browser',
        'html',
        'iframe_host.html'
    ),
    title: 'AUX VM',
    filename: 'aux-vm-iframe.html',
}),
```

4. Ensure that `aux-vm-iframe.html` is available at the root path of the site.

## Usage

#### Connect to an AUX

```javascript
import { BotManager, AuxVMImpl } from '@casual-simulation/aux-vm-browser';
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

    const config = {
        isBuilder: false,
        isPlayer: false,
    };

    const partitions = BotManager.createPartitions(id, user, config);

    // Create a file manager.
    // This represents an in-browser AUX simulation.
    const sim = new BotManager(
        user,
        id,
        config,
        new AuxVMImpl(user, {
            config,
            partitions,
        })
    );

    // Initialize the simulation.
    // This will setup a web worker and pipe
    // events between the worker and main thread.
    await sim.init();

    // Listen for the sync state to change to "synced".
    // When we're synced we know we have the most up to date data
    // and we can communicate our changes to the server.
    // Note that this will not fire if we are not allowed to connect.
    // This may happen if we are not authenticated/authorized.
    sim.connection.syncStateChanged.subscribe((synced) => {
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
