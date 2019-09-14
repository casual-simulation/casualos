#! /usr/bin/env node

import program from 'commander';
import { WebSocketClient, WebSocketServer } from '../src';
import { Server } from 'http';
import { TunnelMessage } from 'src/TunnelResponse';
import { Observable } from 'rxjs';

program.version('0.0.1');

program.command('serve <listenPort>').action(listenPort => {
    const http = new Server();
    const server = new WebSocketServer(http);

    server.listen();
    http.listen(listenPort);
});

program
    .command('connect <url>')
    .option('-f, --forward [localPort]', 'Open a forward tunnel.')
    .option(
        '-r, --reverse [remotePort]',
        'Open a reverse tunnel. Optionally accepts the port that should be opened on the remote.'
    )
    .option('-h, --host <host>', 'The host to connect to.')
    .option('-p, --port <port>', 'The port to connect to.', 80)
    .option('-a, --auth <auth>', 'The authorization token to use.', '')
    .action((url, cmd) => {
        const client = new WebSocketClient(url);

        let o: Observable<TunnelMessage>;
        if (cmd.reverse) {
            o = client.open({
                direction: 'reverse',
                localPort: cmd.port,
                localHost: cmd.host,
                remotePort: cmd.reverse || 8081,
                token: cmd.auth,
            });
        } else {
            o = client.open({
                direction: 'forward',
                localPort: cmd.forward || 8081,
                remoteHost: cmd.host,
                remotePort: cmd.port,
                token: cmd.auth,
            });
        }

        o.subscribe(
            m => {},
            err => {
                console.error(
                    'Client disconnected from server with error: ',
                    err
                );
                console.log('Done.');
            }
        );
    });

program.parse(process.argv);
