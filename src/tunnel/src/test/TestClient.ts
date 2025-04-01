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
import type { TunnelClient } from '../TunnelClient';
import type { TunnelRequest } from '../ClientTunnelRequest';
import type { TunnelMessage } from '../TunnelResponse';
import type { Observer } from 'rxjs';
import { Observable, Subject } from 'rxjs';

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
        return new Observable((observer: Observer<TunnelMessage>) => {
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
