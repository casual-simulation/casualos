import { AuxAuth, LoginStatus, LoginUIStatus } from '@casual-simulation/aux-vm';
import { AuthData } from '@casual-simulation/aux-common';
import {
    listenForChannel,
    listenForChannels,
    setupChannel,
    waitForLoad,
} from '../../../aux-vm-browser/html/IFrameHelpers';
import { authManager } from '../shared/index';
import {
    CreatePublicRecordKeyResult,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-records';
import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';
import { BehaviorSubject, Subject, merge, from, NEVER } from 'rxjs';
import {
    first,
    map,
    tap,
    share,
    filter,
    switchMap,
    mergeAll,
} from 'rxjs/operators';

declare let ENABLE_SMS_AUTHENTICATION: boolean;

const REFRESH_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7; // 1 week

/**
 * Defines a class that implements the backend for an AuxAuth instance.
 */
export class AuthHandler implements AuxAuth {
    private _loggedIn: boolean = false;
    private _loginData: AuthData;
    private _userId: string;
    private _token: string;
    private _refreshTimeout: any;
    private _loginStatus: BehaviorSubject<LoginStatus> = new BehaviorSubject(
        {}
    );
    private _loginUIStatus: BehaviorSubject<LoginUIStatus> =
        new BehaviorSubject({ page: false });
    private _useCustomUI: boolean = false;
    private _providedEmails: Subject<string> = new Subject();
    private _providedSms: Subject<string> = new Subject();
    private _canceledLogins: Subject<void> = new Subject();
    private _providedCodes: Subject<string> = new Subject();

    async isLoggedIn(): Promise<boolean> {
        if (this._loggedIn) {
            const expiry = this._getTokenExpirationTime(this._token);
            if (Date.now() < expiry) {
                return true;
            }
        }
        return false;
    }

    async login(backgroundLogin?: boolean): Promise<AuthData> {
        if (await this.isLoggedIn()) {
            return this._loginData;
        }
        this._loginStatus.next({
            isLoggingIn: true,
        });

        if (await this._checkLoginStatus()) {
            console.log('[AuthHandler] Already logged in.');
            await this._loadUserInfo();
            return this._loginData;
        } else if (!backgroundLogin) {
            let userId: string;
            if (this._useCustomUI) {
                console.log('[AuthHandler] Attempting login with Custom UI.');
                userId = await this._loginWithCustomUI();
            } else {
                console.log('[AuthHandler] Attempting login with new tab.');
                userId = await this._loginWithNewTab();
            }

            if (userId) {
                this._userId = userId;
                await this._loadUserInfo();

                this._loginStatus.next({
                    authData: this._loginData,
                });
                return this._loginData;
            } else {
                this._loginStatus.next({
                    authData: null,
                });
                return null;
            }
        } else {
            console.log('[AuthHandler] Skipping login with UI.');
        }

        this._loginStatus.next({
            authData: this._loginData,
        });

        return this._loginData;
    }

    async createPublicRecordKey(
        recordName: string,
        policy?: PublicRecordKeyPolicy
    ): Promise<CreatePublicRecordKeyResult> {
        console.log('[AuthHandler] Creating public record key:', recordName);
        if (!(await this.isLoggedIn())) {
            await this.login();
        }

        if (!(await this.isLoggedIn())) {
            console.log(
                '[AuthHandler] Unauthorized to create public record key.'
            );
            return {
                success: false,
                errorCode: 'not_logged_in',
                errorMessage: 'User is not logged in.',
                errorReason: 'not_logged_in',
            };
        }

        const key = await authManager.createPublicRecordKey(recordName, policy);
        console.log('[AuthHandler] Record key created.');

        if (key.success === false) {
            if (
                key.errorCode === 'not_logged_in' ||
                key.errorCode === 'unacceptable_session_key' ||
                key.errorCode === 'invalid_key' ||
                key.errorCode === 'session_expired'
            ) {
                this._loggedIn = false;
                this._token = null;
                await authManager.logout(false);
                return await this.createPublicRecordKey(recordName, policy);
            }
        }

        return key;
    }

    async getAuthToken(): Promise<string> {
        if (await this.isLoggedIn()) {
            return this._token;
        }

        return null;
    }

    async getProtocolVersion() {
        return 6;
    }

    async getRecordsOrigin(): Promise<string> {
        return Promise.resolve(authManager.apiEndpoint);
    }

    async openAccountPage(): Promise<void> {
        const url = new URL('/', location.origin);
        window.open(url.href, '_blank');
    }

    async addLoginStatusCallback(
        callback: (status: LoginStatus) => void
    ): Promise<void> {
        this._loginStatus.subscribe((status) => callback(status));
    }

    async addLoginUICallback(callback: (status: LoginUIStatus) => void) {
        this._loginUIStatus.subscribe((status) => callback(status));
    }

    async setUseCustomUI(useCustomUI: boolean) {
        this._useCustomUI = !!useCustomUI;
    }

    async provideEmailAddress(
        email: string,
        acceptedTermsOfService: boolean
    ): Promise<void> {
        if (!acceptedTermsOfService) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showAcceptTermsOfServiceError: true,
                errorCode: 'terms_not_accepted',
                errorMessage: 'You must accept the terms of service.',
                supportsSms: this._supportsSms,
            });
            return;
        }
        if (!email) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showEnterEmailError: true,
                errorCode: 'email_not_provided',
                errorMessage: 'You must provide an email address.',
                supportsSms: this._supportsSms,
            });
            return;
        }
        if (!(await authManager.validateEmail(email))) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showInvalidEmailError: true,
                errorCode: 'invalid_email',
                errorMessage: 'The provided email is not accepted.',
                supportsSms: this._supportsSms,
            });
            return;
        }

        console.log('[AuthHandler] Got email.');
        this._providedEmails.next(email);
    }

    async provideSmsNumber(
        sms: string,
        acceptedTermsOfService: boolean
    ): Promise<void> {
        if (!acceptedTermsOfService) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showAcceptTermsOfServiceError: true,
                errorCode: 'terms_not_accepted',
                errorMessage: 'You must accept the terms of service.',
                supportsSms: this._supportsSms,
            });
            return;
        }
        if (!sms) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showEnterSmsError: true,
                errorCode: 'sms_not_provided',
                errorMessage: 'You must provide an SMS number.',
                supportsSms: this._supportsSms,
            });
            return;
        }

        sms = sms.trim();
        if (!sms.startsWith('+')) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showInvalidSmsError: true,
                errorCode: 'invalid_sms',
                errorMessage: 'The phone number must include the country code.',
                supportsSms: this._supportsSms,
            });
            return;
        }

        if (!(await authManager.validateSmsNumber(sms))) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showInvalidSmsError: true,
                errorCode: 'invalid_sms',
                errorMessage: 'The provided phone number is not accepted.',
                supportsSms: this._supportsSms,
            });
            return;
        }

        console.log('[AuthHandler] Got SMS number.');
        this._providedSms.next(sms);
    }

    async provideCode(code: string): Promise<void> {
        console.log('[AuthHandler] Got login code.');
        this._providedCodes.next(code);
    }

    async cancelLogin() {
        console.log('[AuthHandler] Canceling login.');
        this._canceledLogins.next();
    }

    private _getTokenExpirationTime(token: string): number {
        const parsed = parseSessionKey(token);
        if (!parsed) {
            return -1;
        }
        return parsed[3];
    }

    private async _checkLoginStatus() {
        console.log('[AuthHandler] Checking login status...');
        const loggedIn = authManager.isLoggedIn();

        if (loggedIn && !authManager.userInfoLoaded) {
            return await authManager.loadUserInfo();
        }
        return loggedIn;
    }

    private async _loadUserInfo() {
        if (!authManager.userInfoLoaded) {
            await authManager.loadUserInfo();
        }
        authManager.loadUserInfo;
        this._token = authManager.savedSessionKey;
        this._loginData = {
            userId: this._userId ?? authManager.userId,
            avatarUrl: authManager.avatarUrl,
            avatarPortraitUrl: authManager.avatarPortraitUrl,
            name: authManager.name,
        };

        this._queueTokenRefresh(this._token);
        this._loggedIn = true;
        console.log('[AuthHandler] Logged In!');

        this._loginStatus.next({
            authData: this._loginData,
        });
    }

    private async _loginWithCustomUI(): Promise<string> {
        try {
            let canceled = this._canceledLogins
                .pipe(
                    first(),
                    map(() => null as string)
                )
                .toPromise();
            let cancelSignal = {
                canceled: false,
            };
            canceled.then(() => {
                cancelSignal.canceled = true;
                return null;
            });

            return await Promise.race<string>([
                canceled,
                this._tryLoginWithCustomUI(cancelSignal),
            ]);
        } finally {
            this._loginUIStatus.next({
                page: false,
            });
        }
    }

    private async _tryLoginWithCustomUI(cancelSignal: {
        canceled: boolean;
    }): Promise<string> {
        this._loginUIStatus.next({
            page: 'enter_address',
            termsOfServiceUrl: this.termsOfServiceUrl,
            siteName: this.siteName,
            supportsSms: this._supportsSms,
        });

        const loginRequests = merge(
            this._providedEmails.pipe(
                filter((email) => !cancelSignal.canceled),
                map((email) => from(authManager.loginWithEmail(email)))
            ),
            this._providedSms.pipe(
                filter((email) => !cancelSignal.canceled),
                map((phone) => from(authManager.loginWithPhoneNumber(phone)))
            )
        ).pipe(mergeAll(), share());

        const logins = loginRequests.pipe(
            switchMap((result) => {
                if (result.success === true) {
                    const address = result.address;
                    const addressType = result.addressType;
                    console.log('[AuthHandler] Email sent.');
                    this._loginUIStatus.next({
                        page: 'check_address',
                        address: result.address,
                        addressType: result.addressType,
                    });

                    return this._providedCodes.pipe(
                        switchMap((code) =>
                            authManager.completeLogin(
                                result.userId,
                                result.requestId,
                                code
                            )
                        ),
                        tap((result) => {
                            if (result.success == false) {
                                if (result.errorCode === 'invalid_code') {
                                    this._loginUIStatus.next({
                                        page: 'check_address',
                                        address: address,
                                        addressType: addressType,
                                        showInvalidCodeError: true,
                                    });
                                }
                            }
                        })
                    );
                } else {
                    console.log('[AuthHandler] Unable to send email.');
                    if (result.errorCode === 'unacceptable_address') {
                        this._loginUIStatus.next({
                            page: 'enter_address',
                            siteName: this.siteName,
                            termsOfServiceUrl: this.termsOfServiceUrl,
                            showInvalidEmailError: true,
                            errorCode: 'invalid_email',
                            errorMessage:
                                'Unable to send an email to the provided email address.',
                            supportsSms: this._supportsSms,
                        });
                    } else if (
                        result.errorCode === 'address_type_not_supported'
                    ) {
                        this._loginUIStatus.next({
                            page: 'enter_address',
                            siteName: this.siteName,
                            termsOfServiceUrl: this.termsOfServiceUrl,
                            showInvalidEmailError: true,
                            errorCode: 'invalid_email',
                            errorMessage: 'Email addresses are not supported',
                            supportsSms: this._supportsSms,
                        });
                    }

                    return NEVER;
                }
            }),
            first((result) => result.success)
        );

        const login = await logins.toPromise();

        if (login.success === false) {
            return null;
        }

        await authManager.loadUserInfo();
        await this._loadUserInfo();

        return authManager.userId;
    }

    private _loginWithNewTab(): Promise<string> {
        console.log('[AuthHandler] Opening login tab...');
        const url = new URL('/', location.origin);
        const newTab = window.open(url.href, '_blank');

        return new Promise((resolve, reject) => {
            let handled = false;
            let userId: string;
            const sub = listenForChannels(newTab.origin).subscribe((port) => {
                const handleClose = () => {
                    if (!handled) {
                        console.log('[AuthHandler] Login canceled.');
                        sub.unsubscribe();
                        reject(new Error('Login failed'));
                    }
                };

                newTab.onclose = () => {
                    handleClose();
                };

                port.addEventListener('message', (message) => {
                    if (message.data.type === 'close') {
                        handleClose();
                    } else if (message.data.type === 'login') {
                        console.log('[AuthHandler] Got User ID.');
                        userId = message.data.userId;
                        handled = true;
                        sub.unsubscribe();
                        newTab.close();
                        resolve(userId);
                    } else if (message.data.type === 'token') {
                        console.log('[AuthHandler] Got token.');
                    }
                });

                if (port.start) {
                    port.start();
                }
            });
        });
    }

    private _queueTokenRefresh(token: string) {
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
        }
        const expiry = this._getTokenExpirationTime(token);
        const now = Date.now();
        const lifetimeMs = expiry - now;
        const refreshTimeMs = Math.max(lifetimeMs - REFRESH_LIFETIME_MS, 0);
        console.log(
            '[AuthHandler] Refreshing token in',
            refreshTimeMs / 1000,
            'seconds'
        );
        this._refreshTimeout = setTimeout(() => {
            this._refreshToken();
        }, refreshTimeMs);
    }

    private async _refreshToken() {
        console.log('[AuthHandler] Refreshing token...');
        if (!this._loginData) {
            console.log('[AuthHandler] Unable to refresh. No login data.');
            return;
        }
        const result = await authManager.replaceSession();
        if (result.success) {
            this._token = result.sessionKey;
            console.log('[AuthHandler] Token refreshed!');
        } else {
            console.error('[AuthHandler] Failed to refresh token.', result);
        }
    }

    private get siteName() {
        return location.host;
    }

    private get termsOfServiceUrl() {
        return new URL('/terms', location.origin).href;
    }

    private get _supportsSms() {
        return ENABLE_SMS_AUTHENTICATION === true;
    }
}
