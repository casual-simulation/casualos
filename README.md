# AUX

![GitHub issues](https://img.shields.io/github/issues/casual-simulation/aux.svg) ![GitHub](https://img.shields.io/github/license/casual-simulation/aux.svg)

A monorepo that contains the AUX (Ambient User Experience) packages.

## Packages

This repository contains the following packages:

-   AUX Common
    -   Library of common code for AUX projects.
    -   Contains the AUX file format and basic primitives to enable realtime-web applications.
-   AUX Server
    -   Web application containing the AUX Projector and AUX Player.
    -   Uses a Node.js server to distribute the files and WebSockets for realtime communication.
    -   Built on top of AUX Common.

## Developing

See [DEVELOPERS.md](./DEVELOPERS.md) for dev environment setup instructions.

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
