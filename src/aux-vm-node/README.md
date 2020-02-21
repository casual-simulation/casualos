# AUX VM Node

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/aux-vm-node.svg)](https://www.npmjs.com/package/@casual-simulation/aux-vm-node)

A set of utilities required to run an AUX in Node.js.

## Installation

```
npm install @casual-simulation/aux-vm-node
```

## Usage

#### Connect to an AUX served from a remote server

```javascript
import { nodeSimulationWithConfig } from '@casual-simulation/aux-vm-node';
import { AuxUser, Simulation } from '@casual-simulation/aux-vm';

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

    // Create an AUX simulation which
    // connects to the given channel on the AUX server.
    // This is a high-level abstraction for
    // an AUX virtual machine and makes it easier to use AUXes.
    const sim = nodeSimulationWithConfig(
        user, // The user that we're connecting as
        'hello', // The ID of the simulation
        {
            config: { // The config values for the AUX Scripts
                isBuilder: false,
                isPlayer: false,

                // The values that should be returned for player.version()
                version: 'v1.0.0',
                versionHash: 'abc',
            },
            partitions: { // The partitions that should be loaded
                // Specify that the "shared" space should be mapped
                // to the 'hello' universe hosted from auxplayer.com.
                shared: {
                    type: 'remote_causal_repo';
                    branch: 'hello';
                    host: 'https://auxplayer.com';
                }
            }
        }
    );

    // Initialize the simulation.
    await sim.init();

    // Listen for the sync state to change to "synced".
    // When we're synced we know we have the most up to date data
    // and we can communicate our changes to the server.
    // Note that this will not fire if we are not allowed to connect.
    // This may happen if we are not authenticated/authorized.
    sim.connection.syncStateChanged.subscribe(synced => {
        if (synced) {
            console.log("We're synced!");
        } else {
            console.log('No longer synced.');
        }
    });
}
```

#### Create a bot

```javascript
// Creates a new bot with a random ID
// with the 'auxColor' tag set to 'red'
// and the 'auxScaleZ' tag set to 2.
await sim.helper.createBot(undefined, {
    auxColor: 'red',
    auxScaleZ: 2,
});
```

#### Run a script

```javascript
// Searches for all the bots that have the 'auxColor' tag
// set to 'red'.
const result = await sim.helper.search('=getBots("auxColor", "red")');
```
