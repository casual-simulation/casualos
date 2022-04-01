import { LoginUIStatus } from '@casual-simulation/aux-vm/auth';
import { AuthHelperInterface } from '@casual-simulation/aux-vm/managers';
import { Observable, Subject } from 'rxjs';
import { AuthEndpointHelper } from './AuthEndpointHelper';

export class AuthHelper {

    private _primary: AuthHelperInterface;
    private _loginUIStatus: Subject<LoginUIStatus>;

    constructor(primaryAuthOrigin: string, primaryRecordsOrigin: string) {
        this._primary = new AuthEndpointHelper(primaryAuthOrigin, primaryRecordsOrigin);
        this._loginUIStatus = new Subject();

        this._primary.loginUIStatus.subscribe(this._loginUIStatus);
    }

    get primary(): AuthHelperInterface {
        return this._primary;
    }

    get loginUIStatus(): Observable<LoginUIStatus> {
        return this._loginUIStatus;
    }

    createEndpoint(endpoint: string): AuthHelperInterface {
        const helper = new AuthEndpointHelper(endpoint);
        helper.loginUIStatus.subscribe(this._loginUIStatus);
        return helper;
    }

}