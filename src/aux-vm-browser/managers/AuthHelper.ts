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
import type { LoginUIStatus } from '@casual-simulation/aux-vm/auth';
import type { AuthHelperInterface } from '@casual-simulation/aux-vm/managers';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { AuthEndpointHelper } from './AuthEndpointHelper';

export class AuthHelper {
    private _primary: AuthHelperInterface;
    private _loginUIStatus: Subject<LoginUIStatus & { endpoint: string }>;
    private _auths: Map<string, AuthHelperInterface>;
    private _useCustomUI: boolean = false;
    private _requirePrivoLogin: boolean;
    private _factory: (
        primaryAuthOrigin: string,
        primaryRecordsOrigin: string,
        sessionKey?: string,
        connectionKey?: string
    ) => AuthHelperInterface;

    private _onEndpointDiscovered: Subject<{
        endpoint: string;
        helper: AuthHelperInterface;
    }> = new Subject();

    get endpoints() {
        return this._auths;
    }

    get onEndpointDiscovered(): Observable<{
        endpoint: string;
        helper: AuthHelperInterface;
    }> {
        return this._onEndpointDiscovered.pipe(
            startWith(
                ...[...this._auths.entries()].map(([endpoint, helper]) => ({
                    endpoint,
                    helper,
                }))
            )
        );
    }

    get primaryAuthOrigin() {
        return this._primary.origin;
    }

    constructor(
        primaryAuthOrigin: string,
        primaryRecordsOrigin: string,
        factory?: (
            primaryAuthOrigin: string,
            primaryRecordsOrigin: string,
            sessionKey?: string,
            connectionKey?: string
        ) => AuthHelperInterface,
        requirePrivoLogin?: boolean,
        primarySessionKey?: string,
        primaryConnectionKey?: string
    ) {
        this._factory =
            factory ??
            ((
                primaryAuthOrigin,
                primaryRecordsOrigin,
                sessionKey,
                connectionKey
            ) =>
                new AuthEndpointHelper(
                    primaryAuthOrigin,
                    primaryRecordsOrigin,
                    requirePrivoLogin,
                    sessionKey,
                    connectionKey
                ));
        this._primary = this._factory(
            primaryAuthOrigin,
            primaryRecordsOrigin,
            primarySessionKey,
            primaryConnectionKey
        );
        this._auths = new Map();
        this._loginUIStatus = new Subject();
        this._requirePrivoLogin = requirePrivoLogin ?? false;
        this._primary.loginUIStatus
            .pipe(map((s) => ({ ...s, endpoint: primaryAuthOrigin })))
            .subscribe(this._loginUIStatus);
        this._auths.set(primaryAuthOrigin, this._primary);
    }

    get primary(): AuthHelperInterface {
        return this._primary;
    }

    get loginUIStatus(): Observable<LoginUIStatus & { endpoint: string }> {
        return this._loginUIStatus;
    }

    getOrCreateEndpoint(endpoint: string) {
        let e = this.getEndpoint(endpoint);
        if (!e) {
            e = this._createEndpoint(endpoint);
            this._onEndpointDiscovered.next({ endpoint, helper: e });
        }

        return e;
    }

    getEndpoint(endpoint: string): AuthHelperInterface {
        return this._auths.get(endpoint);
    }

    private _createEndpoint(endpoint: string): AuthHelperInterface {
        console.log('[AuthHelper] Creating endpoint', endpoint);
        const helper = new AuthEndpointHelper(
            endpoint,
            undefined,
            this._requirePrivoLogin
        );
        helper.loginUIStatus
            .pipe(map((s) => ({ ...s, endpoint })))
            .subscribe(this._loginUIStatus);
        this._auths.set(endpoint, helper);
        helper.setUseCustomUI(this._useCustomUI);
        return helper;
    }

    setUseCustomUI(useCustomUI: boolean) {
        this._useCustomUI = useCustomUI;

        for (let auth of this._auths.values()) {
            auth.setUseCustomUI(useCustomUI);
        }
    }
}
