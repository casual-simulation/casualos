# AUX

![GitHub issues](https://img.shields.io/github/issues/casual-simulation/aux.svg) ![GitHub](https://img.shields.io/github/license/casual-simulation/aux.svg)

AUX (Ambient User Experience) is a set of tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.

This repository is a monorepo that contains the code which makes the AUX web platform work.

## Installation

Installing the AUX platform is actually quite simple. All you need is Docker.

### Prerequisites

First, you need a computer that has [Docker][docker] installed on it.
This means any Linux, MacOS, or Windows based machine.

Currently, we support any x86, x64 or ARMv32 based machine.

Follow [these instructions][docker-install] to get Docker installed on your machine.

Second, you need to install [Docker Compose][docker-compose].

If you are running a Mac or Windows machine, then Docker Compose is included in your Docker installation. If you are running a Linux system, then you need to follow the instructions [on their website][docker-compose-install].

### Installation

Once you have Docker installed, you can install AUX.

First, download the correct `docker-compose.yml` file.

#### If you are running an x64 or x86 machine, download `docker-compose.yml`:

Linux/Mac:

```bash
$ curl https://raw.githubusercontent.com/casual-simulation/aux/master/docker-compose.yml --output docker-compose.yml
```

Or on Windows using PowerShell:

```powershell
Invoke-WebRequest -OutFile docker-compose.yml https://raw.githubusercontent.com/casual-simulation/aux/master/docker-compose.yml
```

#### If you are running an ARM machine, download `docker-compose.arm32.yml`:

Linux/Mac:

```bash
$ curl https://github.com/casual-simulation/aux/blob/master/docker-compose.arm32.yml -- output docker-compose.yml
```

Windows:

```powershell
Invoke-WebRequest -OutFile docker-compose.yml https://github.com/casual-simulation/aux/blob/master/docker-compose.arm32.yml
```

Next, load the compose file into docker. This will download the applications and services and run them.

```bash
$ docker-compose up -d
```

You're done!

To access your AUX, simply visit `http://{your_ip_address}/hello/world` in a web browser.

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

[docker]: https://www.docker.com/
[docker-install]: https://docs.docker.com/install/
[docker-compose]: https://docs.docker.com/compose/install/
[docker-compose-install]: https://docs.docker.com/compose/install/
