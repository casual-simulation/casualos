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

To access your AUX, simply visit `http://{your_ip_address}` in a web browser.

## Configuration

The AUX Server Docker image can be configured using the following environment variables:

-   `MONGO_URL`: The [MongoDB Connection String](https://docs.mongodb.com/manual/reference/connection-string/) that the server should use to connect to MongoDB for storage. (REQUIRED)
-   `MONGO_USE_NEW_URL_PARSER` - Whether to use the [new MongoDB URL parser](https://stackoverflow.com/q/50448272/1832856). (Defaults to false)
-   `MONGO_USE_UNIFIED_TOPOLOGY` - Whether to enable the new unified topology layer. (Defaults to false)
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
-   `DEBUG`: Whether to enable debug mode. Setting this to `true` will enable some more debug logs, particularly for Deno.
-   `CAUSAL_REPO_CONNECTION_PROTOCOL`: The connection protocol that should be used for causal repos. Controls which backends the causal repos can connect to. Possible options are `socket.io` and `apiary-aws`. The `socket.io` protocol works with Raspberry PIs and self-hosted servers (like in development). The `apiary-aws` protocol works with [CasualOS apiaries hosted on AWS](https://github.com/casual-simulation/casual-apiary-aws). Defaults to `socket.io`.
-   `CAUSAL_REPO_CONNECTION_URL`: The URL that causal repos should connect to. If not specified, then the URL that the site is hosted from will be used. Useful in development to connect to a different causal repo host than the local socket.io based one.
-   `SHARED_PARTITIONS_VERSION`: The version of the shared partitions that should be used. The "shared partitions" are the services used to implement the shared spaces (`shared`, `tempShared`, and `remoteTempShared`). Possible options are `v1` and `v2`. `v1` indicates using the causal repo system which uses atoms to synchronize changes. `v2` indicates using a system that uses [yjs](https://github.com/yjs/yjs) and the communication system built for causal repos to synchronize changes. Protocol versions are not backwards compatible and while causal repo servers support concurrent usage, they only support a single protocol version per server branch. Newer protocols are likely to perform better and be more reliable. Defaults to `v1`.
-   `EXECUTE_LOADED_STORIES`: Whether to let the server instantiate server-side runtimes to execute story code. Setting this to `true` will cause a sandbox to be created for every story that gets loaded. Note that for compatibility reasons this does not affect server-side execution for webhooks. The benefit of this flag is that fewer stories will be loaded when using the `none` option for `SANDBOX_TYPE` thereby making it less likely that the server will get locked up. Defaults to `true`.
-   `DISABLE_COLLABORATION`: Set this to true to disable networking in the shared space. When true, the `shared` space will actually use a `tempLocal` partition.

## Build Configuration

The AUX build can be configured using the following environment variables:

-   `PROXY_CORS_REQUESTS` - Whether to proxy HTTP GET requests that would trigger CORS through the proxy hosted by the server. Possible options are `true` and `false`. (Defaults to `true`)

## Security Note

In the default configuration, CasualOS allows running arbitrary user scripts inside the web server process. Potential capabilities include filesystem access, executing commands, making arbitrary web requests, and reading environment variables.

Therefore, it is highly recommended to isolate the web server from other sensitive networks and components to ensure malicious scripts cannot infect them.

[docker]: https://www.docker.com/
[docker-install]: https://docs.docker.com/install/
[docker-compose]: https://docs.docker.com/compose/install/
[docker-compose-install]: https://docs.docker.com/compose/install/
