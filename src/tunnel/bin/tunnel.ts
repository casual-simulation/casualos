#! /usr/bin/env node

/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import program from 'commander';
import { WebSocketClient, WebSocketServer } from '../src';
import { Server } from 'http';
import type { TunnelMessage } from 'src/TunnelResponse';
import type { Observable } from 'rxjs';

program.version('0.0.1');

program.command('serve <listenPort>').action((listenPort) => {
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
            const remotePort = parseInt(cmd.reverse);
            o = client.open({
                direction: 'reverse',
                localPort: cmd.port,
                localHost: cmd.host,
                remotePort: remotePort || 8081,
                token: cmd.auth,
            });
        } else {
            const localPort = parseInt(cmd.forward);
            o = client.open({
                direction: 'forward',
                localPort: localPort || 8081,
                remoteHost: cmd.host,
                remotePort: cmd.port,
                token: cmd.auth,
            });
        }

        o.subscribe({
            next: (m) => {},
            error: (err) => {
                console.error(
                    'Client disconnected from server with error: ',
                    err
                );
                console.log('Done.');
            },
        });
    });

program.parse(process.argv);
