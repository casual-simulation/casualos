# AUX Server

A web application that serves the Channel Designer and AUX Player experiences.
Built on top of the AUX Common library.

### Channel Designer

A single page web application that allows people to edit AUXes in realtime.

### AUX Player

A single page web application that allows people to view and interact with AUXes in realtime.

### Server

A Node.JS server that is able to facilitate realtime communication for the Channel Designer and AUX Player applications via WebSockets.
Also serves the actual Channel Designer and AUX Player HTML and JavaScript files.

## Installation

We provide Docker images for AUX Server on [DockerHub](https://hub.docker.com/). You can find them [here](https://hub.docker.com/u/casualsimulation).

### Mac/Linux/Windows (x86 or x64)

#### Prerequisites

First, you need a computer that has [Docker][docker] installed on it.
This means any Linux, MacOS, or Windows based machine.

Currently, we support any x86, x64 or ARMv32 based machine.

Follow [these instructions][docker-install] to get Docker installed on your machine.

Second, you need to install [Docker Compose][docker-compose].

If you are running a Mac or Windows machine, then Docker Compose is included in your Docker installation. If you are running a Linux system, then you need to follow the instructions [on their website][docker-compose-install].

#### Installation

Once you have Docker installed, you can install AUX.

First, download the correct `docker-compose.yml` file.

Linux/Mac:

```bash
$ curl https://raw.githubusercontent.com/casual-simulation/aux/master/docker-compose.yml --output docker-compose.yml
```

Or on Windows using PowerShell:

```powershell
Invoke-WebRequest -OutFile docker-compose.yml https://raw.githubusercontent.com/casual-simulation/aux/master/docker-compose.yml
```

Next, load the compose file into docker. This will download the applications and services and run them.

```bash
$ docker-compose up -d
```

### Raspberry PI (ARM 32)

On Raspberry PI, we provide an [installation script](https://github.com/casual-simulation/aux/blob/master/install.sh) which can be used to automatically install AUX with all of its dependencies.

1. Download the script

```bash
$ curl https://raw.githubusercontent.com/casual-simulation/aux/master/install.sh -s -o install-aux.sh
```

2. Run the script

```bash
$ ./install-aux.sh
```

3. Follow the instructions. When it is done, AUX will be installed and running. Note that the device may restart during installation.

You're done!

To access your AUX, simply visit `http://{your_ip_address}/*/admin` in a web browser.

[docker]: https://www.docker.com/
[docker-install]: https://docs.docker.com/install/
[docker-compose]: https://docs.docker.com/compose/install/
[docker-compose-install]: https://docs.docker.com/compose/install/
