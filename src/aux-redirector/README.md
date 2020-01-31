# AUX Redirector

A simple web service that redirects old style aux URLs to the new version.

In essence, a request for `https://casualos.com/*dimension/universe` gets redirected to `https://auxplayer.com?auxUniverse=universe&auxSheetDimension=dimension`.

## Installation

### Mac/Linux/Windows (x86 or x64)

First, you need a computer that has [Docker][docker] installed on it.
This means any Linux, MacOS, or Windows based machine.

Currently, we support any x86 or x64 based machine.

Follow [these instructions][docker-install] to get Docker installed on your machine.

Once you have Docker installed, you can run AUX Proxy via docker.

```
$ docker run -d -p 3000:3000 casualsimulation/aux-redirector:latest
```

Once complete, the service will be running and available on the local machine on port 3000. For production, we recommend using TLS which you can add by using Nginx as a reverse proxy in front of the AUX Proxy service.

## Configuration

The AUX Proxy Docker image can be configured using the following environment variables:

-   `PROXY_IP_RANGE`: The [Express trust proxy](https://expressjs.com/en/guide/behind-proxies.html) value that should be used to tell Express which IP Addresses to trust as Proxies. (Required if using Nginx as a reverse proxy)

[docker]: https://www.docker.com/
[docker-install]: https://docs.docker.com/install/
