import { Duplex } from 'stream';
import WebSocket from 'ws';

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

        this._ws.on('message', m => {
            if (typeof m === 'string') {
                throw new Error('Unsupported data type.');
            } else {
                this.push(m);
            }
        });

        this._ws.on('close', () => {
            this.emit('close');
        });
        this._ws.on('error', err => {
            this.emit('error');
        });
    }

    end() {
        super.end();
        this._ws.close();
    }

    _read() {}
    _write(chunk: Buffer, encoding: string, callback: (err?: any) => void) {
        this._ws.send(chunk, callback);
    }
}
