import { TunnelClient } from '../TunnelClient';
import { TunnelRequest } from '../ClientTunnelRequest';
import { TunnelMessage } from '../TunnelResponse';
import { Observable, Observer, Subject } from 'rxjs';

export interface TestRequest {
    accept(): void;
    close(): void;
    error(error: any): void;
    request: TunnelRequest;
}

/**
 * Defines a tunnel client that can be used for testing.
 */
export class TestClient implements TunnelClient {
    private _requests: Subject<TestRequest> = new Subject();

    get requests(): Observable<TestRequest> {
        return this._requests;
    }

    open(request: TunnelRequest): Observable<TunnelMessage> {
        return Observable.create((observer: Observer<TunnelMessage>) => {
            const req: TestRequest = {
                request: request,
                accept() {
                    observer.next({
                        type: 'connected',
                    });
                },
                error(e) {
                    observer.error(e);
                },
                close() {
                    observer.complete();
                },
            };

            this._requests.next(req);
        });
    }
}
