# AUX VM

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/aux-vm.svg)](https://www.npmjs.com/package/@casual-simulation/aux-vm)

A set of abstractions and common utilities required to run an AUX on any platform.

## Installation

```
npm install @casual-simulation/aux-vm
```

## Usage

#### Create a custom simulation class

```typescript
import { BaseSimulation, AuxVM } from '@casual-simulation/aux-vm';

// Simulations are wrappers for an
// AuxVM + AuxChannel combo.
// They make all the capabilities of an AUX easy to access
// and understand.
export class MySimulation extends BaseSimulation {
    constructor(
        id: string, // The ID of the
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        super(id, config, config => new MyAuxVM(config));
    }
}

// An AUX VM is in charge of separating
// the consumer from the AUX Environment.
// Basically its a security barrier between an AUX and the consumer code.
// On Web Browsers, this is usually implemented via web workers and sandboxed iframes.
// On Node.js, this is implemented via a custom script sandbox.
// Below, you can implement your own VM.
export class MyAuxVM implements AuxVM {
    // TODO: Implement
}
```
