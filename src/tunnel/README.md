# Tunnel

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/tunnel.svg)](https://www.npmjs.com/package/@casual-simulation/tunnel)

A WebSockets-based TCP tunnel library and CLI.

Allows the creation of forward and reverse [tunnels](https://en.wikipedia.org/wiki/Tunneling_protocol) to get around firewalls and [NAT](https://en.wikipedia.org/wiki/Network_address_translation).

## CLI

### Installation

```bash
$ npm install -g @casual-simulation/tunnel
```

### Usage

#### Starting a tunnel server on port 80

```bash
$ tunnel serve 80
```

#### Open a tunnel to `my_server_ip` on port 80 that pipes port 8080 to `example.com` on port 80

```bash
$ tunnel connect ws://my_server_ip:80 --forward 8080 --host example.com --port 80
```

#### Open a reverse tunnel to `my_server_ip` on port 80 that pipes port 8080 on the tunnel server to `127.0.0.1` on port 3000 in the local network.

```bash
$ tunnel connect ws://my_server_ip:80 --reverse 8080 --host 127.0.0.1 --port 3000
```

## Library

### Installation

```bash
$ npm install @casual-simulation/tunnel
```

### Usage

#### Starting a tunnel server

```javascript
import { WebSocketServer } from '@casual-simulation/tunnel';
import { Server as HttpServer } from 'http';

function start() {
    // Create a HTTP Server
    const http = new HttpServer();

    // Create a WebSocket tunnel server that listens for
    // requests on the given HTTP server.
    const tunnel = new WebSocketServer(http);

    tunnel.listen();

    // Start listening for HTTP requests on port 8080
    http.listen(8080);
}
```

#### Authorizing tunnel requests

```javascript
// the acceptTunnel property is a filter function
// which is called in order to determine whether to accept
// a tunnel connection request from a client.
tunnel.acceptTunnel = request => {
    if (request.authorization === 'password') {
        return true;
    } else {
        return false;
    }
};
```

#### Connecting to a tunnel server

```javascript
import { WebSocketClient } from '@casual-simulation/tunnel';

// Create a client that connects to the server at my_server_address
const client = new WebSocketClient('ws://my_server_address');

// Get an observable that opens a tunnel
// connection to the server to connect to
// example.com on port 80 whenever a connection
// is made to port 8080 on the local
// host.
const messages = client.open({
    direction: 'forward',
    token: 'password',
    remoteHost: 'example.com',
    remotePort: 80,
    localPort: 8080,
});

// Start listening
const subscription = messages.subscribe(
    m => console.log(m),
    err => console.error(err)
);

// You can stop listening by disposing of the subscription
subscription.unsubscribe();
```
