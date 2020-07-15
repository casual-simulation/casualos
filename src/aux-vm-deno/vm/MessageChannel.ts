import { Subject } from 'rxjs';

export class MessageEvent {
    data: any;
    constructor(
        type: string,
        init: {
            data: any;
        }
    ) {
        this.data = init.data;
    }
}

const LISTENER_SYMBOL = Symbol('messageListener');

export interface MessageEndpoint {
    addEventListener(
        type: string,
        listener: (e: MessageEvent) => void,
        options?: {}
    ): void;
    removeEventListener(
        type: string,
        listener: (e: MessageEvent) => void,
        options?: {}
    ): void;
    postMessage(message: any): void;
}

export class MessageChannelImpl {
    port1: MessageEndpoint;
    port2: MessageEndpoint;
    private _port1Messages: Subject<MessageEvent>;
    private _port2Messages: Subject<MessageEvent>;

    constructor() {
        this._port1Messages = new Subject();
        this._port2Messages = new Subject();

        this.port1 = {
            addEventListener: (type, listener) => {
                if (type === 'message') {
                    const sub = this._port1Messages.subscribe(<any>listener);
                    (<any>listener)[LISTENER_SYMBOL] = sub;
                }
            },
            removeEventListener: (type, listener) => {
                if (LISTENER_SYMBOL in listener) {
                    (<any>listener)[LISTENER_SYMBOL].unsubscribe();
                }
            },
            postMessage: message => {
                this._port2Messages.next(
                    new MessageEvent('message', {
                        data: message,
                    })
                );
            },
        };
        this.port2 = {
            addEventListener: (type, listener) => {
                if (type === 'message') {
                    const sub = this._port2Messages.subscribe(<any>listener);
                    (<any>listener)[LISTENER_SYMBOL] = sub;
                }
            },
            removeEventListener: (type, listener) => {
                if (LISTENER_SYMBOL in listener) {
                    (<any>listener)[LISTENER_SYMBOL].unsubscribe();
                }
            },
            postMessage: message => {
                this._port1Messages.next(
                    new MessageEvent('message', {
                        data: message,
                    })
                );
            },
        };
    }
}
