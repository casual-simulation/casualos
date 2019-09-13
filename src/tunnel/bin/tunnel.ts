#! /usr/bin/env node

import program from 'commander';
import { WebSocketClient, WebSocketServer } from '../src';
import { Server } from 'http';

program
    .version('0.0.1')
    .option('-s, --serve', 'Be a tunnel server')
    .option('-c, --client', 'Be a tunnel client')
    .option('-r, --reverse', 'Whether to reverse the tunnel.')
    .option('-h, --host <host>', 'The host to connect to.')
    .option('-p, --port <port>', 'The port to connect to.', 80);

program.parse(process.argv);

if (program.serve) {
    const http = new Server();
    const server = new WebSocketServer(http);

    server.listen();
    http.listen(8080);
} else if (program.client) {
    const client = new WebSocketClient('ws://127.0.0.1:8080');

    if (program.reverse) {
        const o = client.open({
            direction: 'reverse',
            localPort: program.port,
            localHost: program.host,
            remotePort: 8081,
            token: '',
        });

        o.subscribe(
            m => {},
            err => {
                console.error(err);
            }
        );
    } else {
        const o = client.open({
            direction: 'forward',
            localPort: 8081,
            remoteHost: program.host,
            remotePort: program.port,
            token: '',
        });

        o.subscribe(
            m => {},
            err => {
                console.error(err);
            }
        );
    }
} else {
    console.log('Nothing specified.');
}
