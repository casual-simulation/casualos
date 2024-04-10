import { LoginUIStatus } from '@casual-simulation/aux-vm/auth';
import { AuthHelperInterface } from '@casual-simulation/aux-vm/managers';
import { Observable, Subject } from 'rxjs';
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
