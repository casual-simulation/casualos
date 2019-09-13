#! /usr/bin/env node

import program from 'commander';
import { WebSocketClient, WebSocketServer } from '../src';
import { Server } from 'http';

program.version('0.0.1');

program.command('serve <listenPort>').action(listenPort => {
    const http = new Server();
    const server = new WebSocketServer(http);

    server.listen();
    http.listen(listenPort);
});

program
    .command('connect <url>')
    .option('-f, --forward [localPort]', 'Open a forward tunnel.', 8081)
    .option(
        '-r, --reverse [remotePort]',
        'Open a reverse tunnel. Optionally accepts the port that should be opened on the remote.',
        8081
    )
    .option('-h, --host <host>', 'The host to connect to.')
    .option('-p, --port <port>', 'The port to connect to.', 80)
    .option('-a, --auth <auth>', 'The authorization token to use.', '')
    .action((url, cmd) => {
        const client = new WebSocketClient(url);

        if (cmd.reverse) {
            const o = client.open({
                direction: 'reverse',
                localPort: cmd.port,
                localHost: cmd.host,
                remotePort: cmd.reverse,
                token: cmd.auth,
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
                localPort: cmd.forward,
                remoteHost: cmd.host,
                remotePort: cmd.port,
                token: cmd.auth,
            });

            o.subscribe(
                m => {},
                err => {
                    console.error(err);
                }
            );
        }
    });

program.parse(process.argv);
