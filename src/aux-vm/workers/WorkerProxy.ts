import { Observable, Observer } from 'rxjs';
import { first, filter, map } from 'rxjs/operators';
import {
    WorkerMessage,
    WorkerProxyResponse,
    WorkerProxyRequest,
    ObservableRef,
    WorkerProxyEvent,
    WorkerProxySubscribe,
    WorkerProxyUnsubscribe,
} from './WorkerMessages';
import uuid from 'uuid/v4';
import { createWorkerObservable } from './utils';

export interface CreateProxyOptions {
    knownObservables: string[];
}

export function createProxy<T>(
    worker: Worker,
    options?: CreateProxyOptions
): T {
    options = Object.assign(
        {
            knownObservables: [],
        },
        options
    );

    const observable = createWorkerObservable(worker);
    let count = 0;

    return <any>new Proxy(worker, {
        get(obj, prop: string) {
            const index = options.knownObservables.indexOf(prop);
            if (index >= 0) {
                return createObservable(obj, observable, {
                    $isObservable: true,
                    path: prop,
                    arguments: null,
                });
            }

            return async function() {
                const response = await workerRequest(
                    obj,
                    observable,
                    count++,
                    prop,
                    ...arguments
                );

                if (response && response.$isObservable === true) {
                    return createObservable(obj, observable, response);
                }

                return response;
            };
        },
    });
}

function workerRequest(
    worker: Worker,
    onMessage: Observable<WorkerMessage>,
    count: number,
    name: string,
    ...args: any[]
): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        onMessage
            .pipe(
                first(
                    m =>
                        m.type === 'response' &&
                        m.name === name &&
                        m.requestNumber === count
                )
            )
            .subscribe((message: WorkerProxyResponse) => {
                if (message.error) {
                    reject(message.error);
                } else {
                    resolve(message.value);
                }
            });

        worker.postMessage(<WorkerProxyRequest>{
            type: 'request',
            name: name,
            requestNumber: count,
            arguments: args,
        });
    });
}

function createObservable(
    obj: Worker,
    onMessage: Observable<WorkerMessage>,
    ref: ObservableRef
): Observable<any> {
    return Observable.create((observer: Observer<any>) => {
        const key = uuid();

        const sub = onMessage
            .pipe(
                filter(m => m.type === 'event' && m.key === key),
                map((m: WorkerProxyEvent) => m.value)
            )
            .subscribe(observer);

        obj.postMessage(<WorkerProxySubscribe>{
            type: 'subscribe',
            key: key,
            name: ref.path,
            arguments: ref.arguments,
        });

        return () => {
            sub.unsubscribe();
            obj.postMessage(<WorkerProxyUnsubscribe>{
                type: 'unsubscribe',
                key: key,
                name: ref.path,
            });
        };
    });
}
