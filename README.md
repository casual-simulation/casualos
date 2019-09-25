# AUX

![GitHub issues](https://img.shields.io/github/issues/casual-simulation/aux.svg) ![GitHub](https://img.shields.io/github/license/casual-simulation/aux.svg)

AUX (Ambient User Experience) is a set of tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.

This repository is a monorepo that contains the code which makes the AUX web platform work.

## Contents

### Servers

-   AUX Proxy ([Source](./src/aux-proxy/README.md), Docker [x86](https://hub.docker.com/r/casualsimulation/aux-proxy))
-   AUX Server ([Source](./src/aux-server/README.md), Docker [ARM32](https://hub.docker.com/r/casualsimulation/aux-arm32)/[x86](https://hub.docker.com/r/casualsimulation/aux))

### NPM Packages

-   AUX common ([Source](./src/aux-common/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/aux-common))
-   AUX VM ([Source](./src/aux-vm/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/aux-vm))
-   AUX VM Browser ([Source](./src/aux-vm-browser/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/aux-vm-browser))
-   AUX VM Client ([Source](./src/aux-vm-client/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/aux-vm-client))
-   AUX VM Node ([Source](./src/aux-vm-node/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/aux-vm-node))
-   Causal Tree Client Socket.io ([Source](./src/causal-tree-client-socketio/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/causal-tree-client-socketio))
-   Causal Tree Server ([Source](./src/causal-tree-server/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/causal-tree-server))
-   Causal Tree Server socketio ([Source](./src/causal-tree-server-socketio/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/causal-tree-server-socketio))
-   Causal Tree Store Browser ([Source](./src/causal-tree-store-browser/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/causal-tree-store-browser))
-   Causal Tree Store MongoDB ([Source](./src/causal-tree-store-mongodb/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/causal-tree-store-mongodb))
-   Causal Trees ([Source](./src/causal-trees/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/causal-trees))
-   Crypto ([Source](./src/crypto/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/crypto))
-   Crypto Browser ([Source](./src/crypto-browser/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/crypto-browser))
-   Crypto Node ([Source](./src/crypto-node/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/crypto-node))
-   Tunnel ([Source](./src/tunnel/README.md), [NPM](https://www.npmjs.com/package/@casual-simulation/tunnel))

### Miscellaneous

-   AUX Benchmarks ([Source](./src/aux-benchmarks/README.md))

## Developing

See [DEVELOPERS.md](./DEVELOPERS.md) for development environment setup instructions.

## License

```
MIT License

Copyright (c) 2019 Casual Simulation, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
