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
import { Duplex } from 'stream';
import type WebSocket from 'ws';

/**
 * Wraps the given websocket in a normal duplex stream.
 * @param ws
 */
export function wrap(ws: WebSocket): Stream {
    return new Stream(ws);
}

class Stream extends Duplex {
    private _ws: WebSocket;
    constructor(ws: WebSocket) {
        super();
        this._ws = ws;

        this._ws.on('message', (m) => {
            if (typeof m === 'string') {
                throw new Error('Unsupported data type.');
            } else {
                this.push(m);
            }
        });

        this._ws.on('close', () => {
            this.emit('close');
        });
        this._ws.on('error', (err) => {
            this.emit('error', err);
        });
    }

    end(...args: any[]): this {
        super.end(...args);
        this._ws.close();
        return this;
    }

    _read() {}
    _write(chunk: Buffer, encoding: string, callback: (err?: any) => void) {
        this._ws.send(chunk, callback);
    }
}
