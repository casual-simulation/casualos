# AUX Proxy

A simple web service that can initiate a reverse proxy <--> reverse tunnel session.

The goal of this service is to allow remote access to an AUX Server which resides inside a network behind [NAT](https://en.wikipedia.org/wiki/Network_address_translation).

This service provides a [reverse tunnel](https://unix.stackexchange.com/questions/46235/how-does-reverse-ssh-tunneling-work) to directory clients which have obtained an authorization token from the directory server. When a HTTP connection is initated to the proxy service at `{key}.proxy_domain_name.com` then the connection is forwarded onto the correct AUX instance to allow for remote access.

## Installation

### Mac/Linux/Windows (x86 or x64)

First, you need a computer that has [Docker][docker] installed on it.
This means any Linux, MacOS, or Windows based machine.

Currently, we support any x86 or x64 based machine.

Follow [these instructions][docker-install] to get Docker installed on your machine.

Once you have Docker installed, you can run AUX Proxy via docker.

```
$ docker run -d -p 3000:3000 casualsimulation/aux-proxy:latest
```

Once complete, the service will be running and available on the local machine on port 3000. For production, we recommend using TLS which you can add by using Nginx as a reverse proxy in front of the AUX Proxy service.

## Configuration

The AUX Proxy Docker image can be configured using the following environment variables:

-   `DIRECTORY_TOKEN_SECRET`: The secret which should be used to verify tokens from the AUX Directory.
-   `PROXY_IP_RANGE`: The [Express trust proxy](https://expressjs.com/en/guide/behind-proxies.html) value that should be used to tell Express which IP Addresses to trust as Proxies. (Required if using Nginx as a reverse proxy)

[docker]: https://www.docker.com/
[docker-install]: https://docs.docker.com/install/
