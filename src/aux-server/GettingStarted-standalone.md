# Standalone Setup

To get started with hosting a single-server implementation of CasualOS, follow the instructions in this document.

## Installation

We provide Docker images for CasualOS on [DockerHub](https://hub.docker.com/) and [GitHub](https://github.com). You can find them [here](https://hub.docker.com/u/casualsimulation) and [here](https://github.com/orgs/casual-simulation/packages?repo_name=casualos).

### Mac/Linux/Windows (x86 or x64)

#### Prerequisites

First, you need a computer that has [Docker][docker] installed on it.
This means any Linux, MacOS, or Windows based machine.

Currently, we support any x86, x64 or ARMv32 based machine.

Follow [these instructions][docker-install] to get Docker installed on your machine.

Second, you need to install [Docker Compose][docker-compose].

If you are running a Mac or Windows machine, then Docker Compose is included in your Docker installation. If you are running a Linux system, then you need to follow the instructions [on their website][docker-compose-install].

#### Installation

Once you have Docker installed, you can install CasualOS.

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

3. Follow the instructions. When it is done, CasualOS will be installed and running. Note that the device may restart during installation.

You're done!

To access CasualOS, simply visit `http://{your_ip_address}` in a web browser.

## Configuration

The CasualOS Docker image can be configured using the following environment variables:

### Required

The following environment variables are required:

-   `MONGO_URL`: The [MongoDB Connection String](https://docs.mongodb.com/manual/reference/connection-string/) that the server should use to connect to MongoDB for storage. (REQUIRED)

### Optional

The following environment variables are optional:

#### ab-1

Use the following environment variables to configure ab-1.

-   `AB1_BOOTSTRAP_URL`: The URL that ab-1 should be loaded from. If this is not specified, then ab-1 will be loaded from `https://bootstrap.casualos.com/ab1.aux` in production and `https://bootstrap.casualos.com/staging/ab1.aux` in staging.
-   `AUX_PLAYER_MODE`: The player mode that this instance should indicate to scripts. `"player"` indicates that the inst is supposed to be for playing AUXes while `"builder"` indicates that the inst is used for building AUXes. Defaults to `"builder"`.

#### Collaboration Features

Use the following environment variables to configure the inst collaboration features.

-   `EXECUTE_LOADED_STORIES`: Whether to let the server instantiate server-side runtimes to execute story code. Setting this to `true` will cause a sandbox to be created for every story that gets loaded. Note that for compatibility reasons this does not affect server-side execution for webhooks. The benefit of this flag is that fewer stories will be loaded when using the `none` option for `SANDBOX_TYPE` thereby making it less likely that the server will get locked up. Defaults to `true`.
-   `DISABLE_COLLABORATION`: Set this to true to disable networking in the shared space. When true, the `shared` space will actually use a `tempLocal` partition.
-   `CAUSAL_REPO_CONNECTION_PROTOCOL`: The connection protocol that should be used for causal repos. Controls which backends the causal repos can connect to. Possible options are `websocket` and `apiary-aws`. The `websocket` protocol works with Raspberry PIs and self-hosted servers (like in development). The `apiary-aws` protocol works with [CasualOS apiaries hosted on AWS](https://github.com/casual-simulation/casualos). Defaults to `websocket`.
-   `CAUSAL_REPO_CONNECTION_URL`: The URL that causal repos should connect to. If not specified, then the URL that the site is hosted from will be used. Useful in development to connect to a different causal repo host than the local websocket based one.
-   `SHARED_PARTITIONS_VERSION`: The version of the shared partitions that should be used. The "shared partitions" are the services used to implement the shared spaces (`shared`, `tempShared`, and `remoteTempShared`). Currently, the only possible option is `v2`. Defaults to `v2`.
-   `PREFERRED_INST_SOURCE`: The preferred source for loading instances. Possible options are `"public"` and `"private"`. `"public"` means that public instances will be loaded if not already specified in the URL. `"private"` means that private insts will be loaded if not already specified in the URL. Defaults to `"private"`.
-   `FRONTEND_ORIGIN`: The HTTP Origin that the CasualOS frontend is available at.
-   `COLLABORATIVE_REPO_LOCAL_PERSISTENCE`: Set this to `true` to enable local (IndexedDB) persistence for shared inst data. Currently experimental and may not work properly when enabled. Defaults to `false`.
-   `STATIC_REPO_LOCAL_PERSISTENCE`: Set this to `true` to enable local (IndexedDB) persistence for static inst data. Defaults to `true`.
-   `BIOS_OPTIONS`: The comma-separated list of allowed bios options. If omitted, then all options are enabled. Possible options are `enter join code`, `static inst`, `public inst`, `private inst`, `sign in`, `sign up`, `sign out`.
-   `DEFAULT_BIOS_OPTION`: The BIOS option that should be selected by default.

#### Privo Features

Use the following environment variables to configure privo features.

-   `REQUIRE_PRIVO_LOGIN` - Set to `true` to require that the user logs in with Privo before collaborative features are enabled. Defaults to `false`.

#### Redis Support

To use Redis for inst data storage, use the following:

-   `REDIS_HOST`: The hostname of the Redis instance that the server should connect to. (If not specified then Redis support will be disabled)
-   `REDIS_PORT`: The port number that the server should connect to on the Redis host.

#### MongoDB Support

To configure MongoDB, use the following:

-   `MONGO_URL`: The [MongoDB Connection String](https://docs.mongodb.com/manual/reference/connection-string/) that the server should use to connect to MongoDB for storage. (REQUIRED)
-   `MONGO_USE_NEW_URL_PARSER` - Whether to use the [new MongoDB URL parser](https://stackoverflow.com/q/50448272/1832856). (Defaults to false)
-   `MONGO_USE_UNIFIED_TOPOLOGY` - Whether to enable the new unified topology layer. (Defaults to false)

#### Security

Use the following environment variables to configure security options:

-   `SANDBOX_TYPE`: The type of sandboxing that should be used to separate AUX Scripts from the host environment. Possible options are `none` and `deno`. `none` provides no sandboxing and therefore no security guarentees. `deno` uses the [Deno](https://deno.land/) runtime. Defaults to `none` while the sandbox is in testing.

#### mapPortal

Use the following to configure the mapPortal and mapping-related features:

-   `ARC_GIS_API_KEY`: The API Key that should be used to access the [ArcGIS API](https://developers.arcgis.com/).
-   `WHAT_3_WORDS_API_KEY`: The API Key that should be used for [what3words](https://what3words.com/) integration.

#### meetPortal

Use the following to configure the meetPortal:

-   `JITSI_APP_NAME`: The name of the Jitsi app that the meetPortal should use.

#### Records (Authentication)

Use the following to configure the records system:

-   `SERVER_CONFIG`: The configuration that should be used for the authentication backend. Should be formatted as a JSON string. Find the full list of supported properties at the bottom of [this file](https://github.com/casual-simulation/casualos/blob/feature/consolidation/src/aux-server/aux-backend/shared/ServerBuilder.ts). If not specified or left empty, then authentication features will be automatically disabled.
-   `AUTH_API_ENDPOINT`: The HTTP endpoint that the auth site should use to access the records API.
-   `AUTH_WEBSOCKET_ENDPOINT`: The HTTP endpoint that the auth site should use to access the records websocket API.
-   `AUTH_WEBSOCKET_PROTOCOL`: The connection protocol that should be used for the records websocket API. Possible options are `websocket` and `apiary-aws`. The `websocket` protocol works with Raspberry PIs and self-hosted servers (like in development). The `apiary-aws` protocol works with [CasualOS apiaries hosted on AWS](https://github.com/casual-simulation/casualos). Defaults to `websocket`.
-   `AUTH_ORIGIN`: The HTTP Origin that the player should use for auth. Defaults to `null` in production and `http://localhost:3002` in development.
-   `RECORDS_ORIGIN`: The HTTP Origin that records should be loaded from and published to. Defaults to `null` in production and `http://localhost:3002` in development.
-   `ENABLE_SMS_AUTHENTICATION`: Whether SMS phone numbers are allowed to be entered into the front-end and used for authentication. Defaults to `false`.

#### Plumbing

Use the following environment variables to configure infrastructure-related options. Generally, these can be left at their default values.

-   `NODE_PORT`: The port number that the server should listen on. (Defaults to 3000)
-   `DIRECTORY_TOKEN_SECRET`: The secret value that should be used to sign directory tokens.
-   `DIRECTORY_WEBHOOK`: The URL that HTTP POST messages should be sent to when a directory client record is updated. (If not specified then the directory server will be disabled)
-   `UPSTREAM_DIRECTORY`: The URL that the directory client should report to. (If not specified then the directory client will be disabled)
-   `PROXY_TUNNEL`: The WebSocket URL that the directory client should attempt to setup a reverse tunnel on. See [aux-proxy](../aux-proxy/README.md) for more information. (If not specified then the client won't attempt to setup a tunnel)
-   `PROXY_IP_RANGE`: The [Express trust proxy](https://expressjs.com/en/guide/behind-proxies.html) value that should be used to tell Express which IP Addresses to trust as Proxies. (Required if using Nginx as a reverse proxy)
-   `DEBUG`: Whether to enable debug mode. Setting this to `true` will enable some more debug logs, particularly for Deno.
-   `STAGE_TYPE`: The type of stage store that should be used for atoms that have not yet been committed. Possible options are `mongodb` and `redis`. `mongodb` uses MongoDB to store atoms while `redis` uses Redis. Note that `redis` is not persistent which makes data loss more likely. Defaults to `redis`.

#### Policies Customization

-   `TERMS_OF_SERVICE`: The Markdown of the terms of service that the sites should use.
-   `PRIVACY_POLICY`: The Markkdown of the privacy policy that the sites should use.
-   `ACCEPTABLE_USE_POLICY`: The Markdown of the Acceptable Use Policy that the sites should use.

## Security Note

In the default configuration, CasualOS allows running arbitrary user scripts inside the web server process. Potential capabilities include filesystem access, executing commands, making arbitrary web requests, and reading environment variables.

Therefore, it is highly recommended to isolate the web server from other sensitive networks and components to ensure malicious scripts cannot infect them.

[docker]: https://www.docker.com/
[docker-install]: https://docs.docker.com/install/
[docker-compose]: https://docs.docker.com/compose/install/
[docker-compose-install]: https://docs.docker.com/compose/install/
