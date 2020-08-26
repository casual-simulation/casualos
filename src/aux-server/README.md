# AUX Server

A web application that serves the auxPlayer experience.
Built on top of the AUX Common library.

### auxPlayer

A single page web application that allows people to view and interact with AUXes in realtime.

### Server

A Node.JS server that is able to facilitate realtime communication for the auxPlayer application via WebSockets.
Also serves the actual auxPlayer HTML and JavaScript files.

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
$ curl https://raw.githubusercontent.com/casual-simulation/aux/master/docker/docker-compose.yml --output docker-compose.yml
```

Or on Windows using PowerShell:

```powershell
Invoke-WebRequest -OutFile docker-compose.yml https://raw.githubusercontent.com/casual-simulation/aux/master/docker/docker-compose.yml
```

Next, load the compose file into docker. This will download the applications and services and run them.

```bash
$ docker-compose up -d
```

### Raspberry PI (ARM 32)

On Raspberry PI, we provide an [installation script](https://github.com/casual-simulation/casualos/blob/master/install.sh) which can be used to automatically install AUX with all of its dependencies.

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

To access your AUX, simply visit `http://{your_ip_address}/?auxUniverse=test&auxPagePortal=home` in a web browser.

## Configuration

The AUX Server Docker image can be configured using the following environment variables:

-   `MONGO_URL`: The [MongoDB Connection String](https://docs.mongodb.com/manual/reference/connection-string/) that the server should use to connect to MongoDB for storage. (REQUIRED)
-   `MONGO_USE_NEW_URL_PARSER` - Whether to use the [new MongoDB URL parser](https://stackoverflow.com/q/50448272/1832856). (Defaults to false)
-   `REDIS_HOST`: The hostname of the Redis instance that the server should connect to. (If not specified then Redis support will be disabled)
-   `REDIS_PORT`: The port number that the server should connect to on the Redis host.
-   `NODE_PORT`: The port number that the server should listen on.
-   `DIRECTORY_TOKEN_SECRET`: The secret value that should be used to sign directory tokens.
-   `DIRECTORY_WEBHOOK`: The URL that HTTP POST messages should be sent to when a directory client record is updated. (If not specified then the directory server will be disabled)
-   `UPSTREAM_DIRECTORY`: The URL that the directory client should report to. (If not specified then the directory client will be disabled)
-   `PROXY_TUNNEL`: The WebSocket URL that the directory client should attempt to setup a reverse tunnel on. See [aux-proxy](../aux-proxy/README.md) for more information. (If not specified then the client won't attempt to setup a tunnel)
-   `PROXY_IP_RANGE`: The [Express trust proxy](https://expressjs.com/en/guide/behind-proxies.html) value that should be used to tell Express which IP Addresses to trust as Proxies. (Required if using Nginx as a reverse proxy)
-   `SANDBOX_TYPE`: The type of sandboxing that should be used to separate AUX Scripts from the host environment. Possible options are `none` and `deno`. `none` provides no sandboxing and therefore no security guarentees. `deno` uses the [Deno](https://deno.land/) runtime. Defaults to `none` while the sandbox is in testing.
-   `STAGE_TYPE`: The type of stage store that should be used for atoms that have not yet been committed. Possible options are `mongodb` and `redis`. `mongodb` uses MongoDB to store atoms while `redis` uses Redis. Note that `redis` is not persistent which makes data loss more likely. Defaults to `redis`.
-   `GPIO`: Whether to enable GPIO support. Enabled by default on ARM. Disabled by default otherwise.

[docker]: https://www.docker.com/
[docker-install]: https://docs.docker.com/install/
[docker-compose]: https://docs.docker.com/compose/install/
[docker-compose-install]: https://docs.docker.com/compose/install/
