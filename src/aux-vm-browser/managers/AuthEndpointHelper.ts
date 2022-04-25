import { wrap, proxy, Remote, expose, transfer, createEndpoint } from 'comlink';
import {
    AuthHelperInterface,
    AuxAuth,
    LoginStatus,
    LoginUIStatus,
} from '@casual-simulation/aux-vm';
import { setupChannel, waitForLoad } from '../html/IFrameHelpers';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { AuthData, hasValue } from '@casual-simulation/aux-common';
import { CreatePublicRecordKeyResult, parseRecordKey, PublicRecordKeyPolicy } from '@casual-simulation/aux-records';

// Save the query string that was used when the site loaded
const query = typeof location !== 'undefined' ? location.search : null;

interface StaticAuxAuth {
    new (): AuxAuth;
}

/**
 * Defines a class that helps handle authentication/authorization for a particular endpoint.
 */
export class AuthEndpointHelper implements AuthHelperInterface {
    private _origin: string;
    private _defaultRecordsOrigin: string;
    private _iframe: HTMLIFrameElement;
    private _channel: MessageChannel;
    private _proxy: Remote<AuxAuth>;
    private _initialized: boolean = false;
    private _protocolVersion: number = 1;
    private _sub: Subscription = new Subscription();
    private _loginStatus: BehaviorSubject<LoginStatus> =
        new BehaviorSubject<LoginStatus>({});
    private _loginUIStatus: BehaviorSubject<LoginUIStatus> =
        new BehaviorSubject<LoginUIStatus>({
            page: false,
        });
    private _initPromise: Promise<void>;
    private _recordsOrigin: string;

    /**
     * Creates a new instance of the AuthHelper class.
     * @param iframeOrigin The URL that the auth iframe should be loaded from.
     * @param defaultRecordsOrigin The HTTP Origin that should be used for the records origin if the auth site does not support protocol version 4.
     */
    constructor(iframeOrigin?: string, defaultRecordsOrigin?: string) {
        this._origin = iframeOrigin;
        this._defaultRecordsOrigin = defaultRecordsOrigin;
    }

    get origin(): string {
        return this._origin;
    }

    get recordsOrigin(): string {
        return this._recordsOrigin ?? this._defaultRecordsOrigin ?? this._origin;
    }

    get loginStatus() {
        return this._loginStatus;
    }

    get loginUIStatus() {
        return this._loginUIStatus;
    }

    /**
     * Gets whether authentication is supported by this inst.
     */
    get supportsAuthentication() {
        return hasValue(this._origin);
    }

    get closed() {
        return this._sub?.closed;
    }

    unsubscribe() {
        return this.dispose();
    }

    dispose() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    private async _init() {
        if (!this._initPromise) {
            this._initPromise = this._initCore();
        }
        return this._initPromise;
    }

    private async _initCore() {
        if (!hasValue(this._origin)) {
            throw new Error(
                'Cannot initialize AuthHelper because no iframe origin is set.'
            );
        }
        this._loginStatus.next({
            isLoading: true,
        });
        const iframeUrl = new URL(`/iframe.html${query}`, this._origin).href;

        const iframe = (this._iframe = document.createElement('iframe'));
        this._sub.add(() => {
            iframe.remove();
        });
        this._iframe.src = iframeUrl;
        this._iframe.style.display = 'none';
        this._iframe.className = 'auth-helper-iframe';

        let promise = waitForLoad(this._iframe);
        document.body.insertBefore(this._iframe, document.body.firstChild);

        await promise;

        this._channel = setupChannel(this._iframe.contentWindow);

        const wrapper = wrap<StaticAuxAuth>(this._channel.port1);
        this._proxy = await new wrapper();
        try {
            this._protocolVersion = await this._proxy.getProtocolVersion();
        } catch (err) {
            console.log(
                '[AuthHelper] Could not get protocol version. Defaulting to version 1.'
            );
            this._protocolVersion = 1;
        }

        if (this._protocolVersion >= 2) {
            await this._proxy.addLoginUICallback(
                proxy((status) => {
                    this._loginUIStatus.next(status);
                })
            );
            await this._proxy.addLoginStatusCallback(
                proxy((status) => {
                    this._loginStatus.next(status);
                })
            );
        }

        if (this._protocolVersion >= 4) {
            this._recordsOrigin = await this._proxy.getRecordsOrigin();
        }

        this._loginUIStatus.subscribe(status => {
            if (!this._iframe) {
                return;
            }
            if (status.page === 'show_iframe') {
                this._iframe.style.display = null;
            } else {
                this._iframe.style.display = 'none';
            }
        });

        this._initialized = true;
    }

    /**
     * Determines if the user is authenticated.
     */
    async isAuthenticated() {
        if (!hasValue(this._origin)) {
            return false;
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.isLoggedIn();
    }

    /**
     * Requests that the user become authenticated if they are not already.
     */
    async authenticate() {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }
        const result = await this._proxy.login();

        if (this._protocolVersion < 2) {
            this._loginStatus.next({
                authData: result,
            });
        }
        return result;
    }

    /**
     * Requests that the user become authenticated entirely in the background.
     * This will not show any UI to the user but may also mean that the user will not be able to be authenticated.
     */
     async authenticateInBackground() {
        if (!hasValue(this._origin)) {
            return null;
        }
        this._loginStatus.next({
            isLoggingIn: true,
        });
        if (!this._initialized) {
            await this._init();
        }
        const result = await this._proxy.login(true);
        if (this._protocolVersion < 2) {
            this._loginStatus.next({
                authData: result,
            });
        }
        return result;
    }

    async createPublicRecordKey(
        recordName: string,
        policy: PublicRecordKeyPolicy
    ): Promise<CreatePublicRecordKeyResult> {
        if (!hasValue(this._origin)) {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Records are not supported on this inst.',
            };
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.createPublicRecordKey(recordName, policy);
    }

    async getRecordKeyPolicy(recordKey: string): Promise<PublicRecordKeyPolicy> {
        const keyInfo = parseRecordKey(recordKey);
        if (!keyInfo) {
            return null;
        }
        const [name, secret, policy] = keyInfo;
        return policy;
    }

    async getAuthToken(): Promise<string> {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.getAuthToken();
    }

    async openAccountPage(): Promise<void> {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 2) {
            return;
        }
        return await this._proxy.openAccountPage();
    }

    async setUseCustomUI(useCustomUI: boolean) {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 2) {
            return;
        }
        return await this._proxy.setUseCustomUI(useCustomUI);
    }

    async provideEmailAddress(email: string, acceptedTermsOfService: boolean) {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 2) {
            return;
        }
        return await this._proxy.provideEmailAddress(
            email,
            acceptedTermsOfService
        );
    }

    async provideSmsNumber(sms: string, acceptedTermsOfService: boolean): Promise<void> {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 3) {
            return;
        }
        return await this._proxy.provideSmsNumber(
            sms,
            acceptedTermsOfService
        );
    }

    async cancelLogin() {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 2) {
            return;
        }
        return await this._proxy.cancelLogin();
    }
}
