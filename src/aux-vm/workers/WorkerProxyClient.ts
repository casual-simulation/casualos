import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';
import { createWorkerObservable } from './utils';
import {
    WorkerProxyRequest,
    WorkerProxyResponse,
    ObservableRef,
    WorkerProxySubscribe,
    WorkerProxyEvent,
    WorkerProxyUnsubscribe,
} from './WorkerMessages';

export function createProxyClient(worker: Worker, obj: any): SubscriptionLike {
    const observable = createWorkerObservable(worker);

    let subs: Map<string, SubscriptionLike> = new Map();

    return observable
        .pipe(
            tap(message => {
                switch (message.type) {
                    case 'request':
                        calculateValue(worker, obj, message);
                        break;
                    case 'subscribe':
                        subscribeTo(worker, obj, subs, message);
                        break;
                    case 'unsubscribe':
                        unsubscribeFrom(worker, obj, subs, message);
                        break;
                }
            })
        )
        .subscribe(null, err => console.error(err));
}

async function calculateValue(
    worker: Worker,
    obj: any,
    message: WorkerProxyRequest
) {
    try {
        const result = await getValue(
            worker,
            obj,
            message.name,
            message.arguments
        );
        worker.postMessage(makeResponse(message, result));
    } catch (ex) {
        worker.postMessage(makeResponse(message, undefined, ex));
    }
}

async function getValue(worker: Worker, obj: any, prop: string, args: any[]) {
    let result: any;
    if (typeof obj[prop] === 'function') {
        result = obj[prop](...args);
    } else {
        result = obj[prop];
    }
    if (result && typeof result.then === 'function') {
        result = await result;
    }
    return result;
}

async function subscribeTo(
    worker: Worker,
    obj: any,
    subs: Map<string, SubscriptionLike>,
    message: WorkerProxySubscribe
) {
    const result = await getValue(worker, obj, message.name, message.arguments);

    // TODO: Add error handlers
    const sub = result.subscribe((val: any) => {
        worker.postMessage(<WorkerProxyEvent>{
            type: 'event',
            key: message.key,
            value: val,
        });
    });

    subs.set(message.key, sub);
}

async function unsubscribeFrom(
    worker: Worker,
    obj: any,
    subs: Map<string, SubscriptionLike>,
    message: WorkerProxyUnsubscribe
) {
    const sub = subs.get(message.key);
    if (sub) {
        sub.unsubscribe();
        subs.delete(message.key);
    }
}

function makeResponse(
    message: WorkerProxyRequest,
    result: any,
    error?: any
): WorkerProxyResponse {
    if (result && typeof result.subscribe === 'function') {
        result = <ObservableRef>{
            $isObservable: true,
            path: message.name,
            arguments: message.arguments,
        };
    }

    return {
        type: 'response',
        error: error,
        value: result,
        requestNumber: message.requestNumber,
        name: message.name,
    };
}
