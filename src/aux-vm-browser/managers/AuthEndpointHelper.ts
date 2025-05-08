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
import type { Remote } from 'comlink';
import { wrap, proxy, expose, transfer, createEndpoint } from 'comlink';
import type {
    AuthHelperInterface,
    AuxAuth,
    LoginHint,
    LoginStatus,
    LoginUIStatus,
    OAuthRedirectRequest,
    PolicyUrls,
    PrivoSignUpInfo,
} from '@casual-simulation/aux-vm';
import { setupChannel, waitForLoad } from '../html/IFrameHelpers';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import type {
    AuthData,
    AvailablePermissions,
    RemoteCausalRepoProtocol,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-common';
import { hasValue, parseRecordKey } from '@casual-simulation/aux-common';
import type {
    GetPlayerConfigResult,
    CreatePublicRecordKeyResult,
    IsValidDisplayNameResult,
    IsValidEmailAddressResult,
    GrantMarkerPermissionResult,
    GrantResourcePermissionResult,
    CompleteLoginSuccess,
    CompleteWebAuthnLoginSuccess,
    ValidateSessionKeyFailure,
} from '@casual-simulation/aux-records';

// Save the query string that was used when the site loaded
const query = typeof location !== 'undefined' ? location.search : null;

interface StaticAuxAuth {
    new (sessionKey?: string, connectionKey?: string): AuxAuth;
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
    protected _sub: Subscription = new Subscription();
    private _loginStatus: BehaviorSubject<LoginStatus> =
        new BehaviorSubject<LoginStatus>({});
    private _loginUIStatus: BehaviorSubject<LoginUIStatus> =
        new BehaviorSubject<LoginUIStatus>({
            page: false,
        });
    private _initPromise: Promise<void>;
    private _recordsOrigin: string;
    private _websocketOrigin: string;
    private _websocketProtocol: RemoteCausalRepoProtocol;
    private _newTab: Window;
    private _tabCloseInterval: any;
    private _requirePrivoLogin: boolean;
    private _initialSessionKey: string;
    private _initialConnectionKey: string;

    private _authenticationPromise: Promise<AuthData>;
    private _authenticating: boolean = false;

    get currentLoginStatus() {
        const status = this._loginStatus.value;
        if (status.authData || status.isLoading || status.isLoggingIn) {
            return status;
        } else {
            return null;
        }
    }

    /**
     * Creates a new instance of the AuthHelper class.
     * @param iframeOrigin The URL that the auth iframe should be loaded from.
     * @param defaultRecordsOrigin The HTTP Origin that should be used for the records origin if the auth site does not support protocol version 4.
     * @param requirePrivoLogin Whether to require that the user login with Privo.
     * @param sessionKey The session key that should be used. If not specified, then the stored session key will be used.
     * @param connectionKey The connection key that should be used. If not specified, then the stored connection key will be used.
     */
    constructor(
        iframeOrigin?: string,
        defaultRecordsOrigin?: string,
        requirePrivoLogin?: boolean,
        sessionKey?: string,
        connectionKey?: string
    ) {
        this._origin = iframeOrigin;
        this._defaultRecordsOrigin = defaultRecordsOrigin;
        this._requirePrivoLogin = requirePrivoLogin;
        this._initialSessionKey = sessionKey;
        this._initialConnectionKey = connectionKey;
    }

    get origin(): string {
        return this._origin;
    }

    get recordsOrigin(): string {
        return (
            this._recordsOrigin ?? this._defaultRecordsOrigin ?? this._origin
        );
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

    protected async _initCore() {
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
        this._iframe.allow = 'publickey-credentials-get *';
        this._iframe.className = 'auth-helper-iframe';

        let promise = waitForLoad(this._iframe);
        document.body.insertBefore(this._iframe, document.body.firstChild);

        await promise;

        this._channel = setupChannel(this._iframe.contentWindow);

        const wrapper = wrap<StaticAuxAuth>(this._channel.port1);
        this._proxy = await new wrapper(
            this._initialSessionKey,
            this._initialConnectionKey
        );
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
        if (this._protocolVersion >= 9) {
            await this._proxy.addOAuthRedirectCallback(
                proxy((request) => {
                    this._handleOAuthRedirectCallback(request);
                })
            );
        }

        if (this._protocolVersion >= 4) {
            this._recordsOrigin = await this._proxy.getRecordsOrigin();
        }

        if (this._protocolVersion >= 9) {
            this._websocketOrigin = await this._proxy.getWebsocketOrigin();
            this._websocketProtocol = await this._proxy.getWebsocketProtocol();
        }

        this._loginUIStatus.subscribe((status) => {
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

    private _handleOAuthRedirectCallback(request: OAuthRedirectRequest) {
        if (this._newTab && !this._newTab.closed) {
            this._newTab.location = request.authorizationUrl;
        } else {
            console.error(
                '[AuthEndpointHelper] Cannot handle oauth redirect callback.'
            );
        }
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
        return await this._isAuthenticatedCore();
    }

    protected async _isAuthenticatedCore() {
        return await this._proxy.isLoggedIn();
    }

    async relogin(): Promise<void> {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }

        if (this._protocolVersion < 12) {
            await this._proxy.logout();
            await this._proxy.login(true);
        } else {
            await this._proxy.relogin();
        }
    }

    /**
     * Requests that the user become authenticated if they are not already.
     */
    async authenticate(hint?: LoginHint) {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }

        if (this._authenticating) {
            return await this._authenticationPromise;
        }

        try {
            this._authenticating = true;
            this._authenticationPromise = this._authenticateCore(hint);
            return await this._authenticationPromise;
        } finally {
            this._authenticating = false;
        }
    }

    protected async _authenticateCore(hint?: LoginHint) {
        if (hint === 'sign in') {
            this._createNewTab();
        }

        const result = await this._proxy.login(undefined, hint);

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
        if (!this._initialized) {
            await this._init();
        }
        return await this._authenticateInBackgroundCore();
    }

    protected async _authenticateInBackgroundCore() {
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
                errorReason: 'not_supported',
            };
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._createPublicRecordKeyCore(recordName, policy);
    }

    protected async _createPublicRecordKeyCore(
        recordName: string,
        policy: PublicRecordKeyPolicy
    ): Promise<CreatePublicRecordKeyResult> {
        return await this._proxy.createPublicRecordKey(recordName, policy);
    }

    async getRecordsOrigin(): Promise<string> {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }
        return (
            this._recordsOrigin ?? this._defaultRecordsOrigin ?? this._origin
        );
    }

    async getWebsocketOrigin(): Promise<string> {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }

        if (this._protocolVersion < 9) {
            return null;
        }

        return this._websocketOrigin;
    }

    async getWebsocketProtocol(): Promise<RemoteCausalRepoProtocol> {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }

        if (this._protocolVersion < 9) {
            return null;
        }

        return this._websocketProtocol ?? null;
    }

    async getRecordKeyPolicy(
        recordKey: string
    ): Promise<PublicRecordKeyPolicy> {
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
        return await this._getAuthTokenCore();
    }

    protected async _getAuthTokenCore(): Promise<string> {
        return await this._proxy.getAuthToken();
    }

    async getConnectionKey(): Promise<string> {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }

        if (this._protocolVersion < 6) {
            return null;
        }
        return await this._getConnectionKeyCore();
    }

    protected async _getConnectionKeyCore(): Promise<string> {
        return await this._proxy.getConnectionKey();
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

        if (this._protocolVersion >= 11) {
            const newTab = window.open('/loading-oauth.html', '_blank');

            const url = await this._proxy.getAccountPage();

            if (newTab && !newTab.closed) {
                newTab.location = url;
            }
        } else {
            return await this._proxy.openAccountPage();
        }
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

    async isValidEmailAddress(
        email: string
    ): Promise<IsValidEmailAddressResult> {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 9) {
            return {
                success: true,
                allowed: true,
            };
        }
        return await this._proxy.isValidEmailAddress(email);
    }

    async isValidDisplayName(
        displayName: string,
        name: string
    ): Promise<IsValidDisplayNameResult> {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 9) {
            return {
                success: true,
                allowed: true,
            };
        }
        return await this._proxy.isValidDisplayName(displayName, name);
    }

    async provideSmsNumber(
        sms: string,
        acceptedTermsOfService: boolean
    ): Promise<void> {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 3) {
            return;
        }
        return await this._proxy.provideSmsNumber(sms, acceptedTermsOfService);
    }

    async provideCode(code: string): Promise<void> {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 5) {
            return;
        }
        return await this._proxy.provideCode(code);
    }

    async provideLoginResult(
        result: CompleteLoginSuccess | CompleteWebAuthnLoginSuccess
    ): Promise<void> {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 10) {
            return;
        }
        return await this._proxy.provideLoginResult(result);
    }

    async providePrivoSignUpInfo(info: PrivoSignUpInfo): Promise<void> {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 9) {
            return;
        }
        return await this._proxy.providePrivoSignUpInfo(info);
    }

    async provideHasAccount(hasAccount: boolean): Promise<void> {
        if (!hasValue(this._origin)) {
            return;
        }

        if (hasAccount) {
            this._createNewTab();
        }

        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 9) {
            return;
        }

        return await this._proxy.provideHasAccount(hasAccount);
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

    async logout() {
        if (!hasValue(this._origin)) {
            return;
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 8) {
            return;
        }
        return await this._logoutCore();
    }

    protected async _logoutCore() {
        return await this._proxy.logout();
    }

    async getPolicyUrls(): Promise<PolicyUrls> {
        if (!hasValue(this._origin)) {
            return {
                privacyPolicyUrl: null,
                termsOfServiceUrl: null,
                codeOfConductUrl: null,
                supportUrl: null,
            };
        }
        if (!this._initialized) {
            await this._init();
        }
        if (this._protocolVersion < 9) {
            return {
                privacyPolicyUrl: null,
                termsOfServiceUrl: null,
                codeOfConductUrl: null,
                supportUrl: null,
            };
        }
        return await this._proxy.getPolicyUrls();
    }

    async getComIdWebConfig(comId: string): Promise<GetPlayerConfigResult> {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.getComIdWebConfig(comId);
    }

    async grantPermission(
        recordName: string,
        permission: AvailablePermissions
    ): Promise<
        | GrantMarkerPermissionResult
        | GrantResourcePermissionResult
        | ValidateSessionKeyFailure
    > {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.grantPermission(recordName, permission);
    }

    private _createNewTab() {
        if (!this._requirePrivoLogin) {
            return;
        }
        this._newTab = window.open('/loading-oauth.html', '_blank');
        if (this._newTab) {
            if (this._tabCloseInterval) {
                clearInterval(this._tabCloseInterval);
            }
            this._tabCloseInterval = setInterval(() => {
                if (!this._newTab || this._newTab.closed) {
                    clearInterval(this._tabCloseInterval);
                }
                if (this._newTab?.closed) {
                    this._newTab = null;
                    this._proxy.provideOAuthLoginComplete();
                }
            }, 500);
        }
    }
}
