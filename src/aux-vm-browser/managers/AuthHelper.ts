import { LoginUIStatus } from '@casual-simulation/aux-vm/auth';
import { AuthHelperInterface } from '@casual-simulation/aux-vm/managers';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthEndpointHelper } from './AuthEndpointHelper';

export class AuthHelper {
    private _primary: AuthHelperInterface;
    private _loginUIStatus: Subject<LoginUIStatus & { endpoint: string }>;
    private _auths: Map<string, AuthHelperInterface>;
    private _useCustomUI: boolean = false;
    private _factory: (
        primaryAuthOrigin: string,
        primaryRecordsOrigin: string
    ) => AuthHelperInterface;

    get primaryAuthOrigin() {
        return this._primary.origin;
    }

    constructor(
        primaryAuthOrigin: string,
        primaryRecordsOrigin: string,
        factory?: (
            primaryAuthOrigin: string,
            primaryRecordsOrigin: string
        ) => AuthHelperInterface
    ) {
        this._factory =
            factory ??
            ((primaryAuthOrigin, primaryRecordsOrigin) =>
                new AuthEndpointHelper(
                    primaryAuthOrigin,
                    primaryRecordsOrigin
                ));
        this._primary = this._factory(primaryAuthOrigin, primaryRecordsOrigin);
        this._auths = new Map();
        this._loginUIStatus = new Subject();
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
        return this.getEndpoint(endpoint) ?? this.createEndpoint(endpoint);
    }

    getEndpoint(endpoint: string): AuthHelperInterface {
        return this._auths.get(endpoint);
    }

    createEndpoint(endpoint: string): AuthHelperInterface {
        const helper = new AuthEndpointHelper(endpoint);
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
