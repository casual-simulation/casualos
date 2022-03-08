import { AuxAuth, LoginStatus, LoginUIStatus } from '@casual-simulation/aux-vm';
import { AuthData } from '@casual-simulation/aux-common';
import {
    listenForChannel,
    listenForChannels,
    setupChannel,
    waitForLoad,
} from '../../../aux-vm-browser/html/IFrameHelpers';
import { authManager } from '../shared/AuthManager';
import { CreatePublicRecordKeyResult } from '@casual-simulation/aux-records';
import { BehaviorSubject, Subject } from 'rxjs';
import { first, map } from 'rxjs/operators';
import { RPCError, RPCErrorCode } from 'magic-sdk';

/**
 * The number of seconds that the token should be refreshed before it expires.
 */
const REFRESH_BUFFER_SECONDS = 5;

const NULL_SERVICE = '(null)';

declare let ENABLE_SMS_AUTHENTICATION: boolean;

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

    async isLoggedIn(): Promise<boolean> {
        if (this._loggedIn) {
            const expiry = this._getTokenExpirationTime(this._token);
            if (this._nowInSeconds() < expiry) {
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
        recordName: string
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
                errorCode: 'unauthorized_to_create_record_key',
                errorMessage: 'User is not logged in.',
            };
        }

        console.log('[AuthHandler] Record key created.');
        return await authManager.createPublicRecordKey(recordName);
    }

    async getAuthToken(): Promise<string> {
        if (await this.isLoggedIn()) {
            return this._token;
        }

        return null;
    }

    async getProtocolVersion() {
        return 3;
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
                page: 'enter_email',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showAcceptTermsOfServiceError: true,
                errorCode: 'terms_not_accepted',
                errorMessage: 'You must accept the terms of service.',
            });
            return;
        }
        if (!email) {
            this._loginUIStatus.next({
                page: 'enter_email',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showEnterEmailError: true,
                errorCode: 'email_not_provided',
                errorMessage: 'You must provide an email address.',
                supportsSms: this._supportsSms
            });
            return;
        }
        if (!(await authManager.validateEmail(email))) {
            this._loginUIStatus.next({
                page: 'enter_email',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showInvalidEmailError: true,
                errorCode: 'invalid_email',
                errorMessage: 'The provided email is not accepted.',
                supportsSms: this._supportsSms
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
                page: 'enter_email',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showAcceptTermsOfServiceError: true,
                errorCode: 'terms_not_accepted',
                errorMessage: 'You must accept the terms of service.',
                supportsSms: true,
            });
            return;
        }
        if (!sms) {
            this._loginUIStatus.next({
                page: 'enter_email',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showEnterSmsError: true,
                errorCode: 'sms_not_provided',
                errorMessage: 'You must provide an SMS address.',
                supportsSms: this._supportsSms
            });
            return;
        }

        sms = sms.trim();
        if (!sms.startsWith('+')) {
            this._loginUIStatus.next({
                page: 'enter_email',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                showInvalidSmsError: true,
                errorCode: 'invalid_sms',
                errorMessage: 'The phone number must include the country code.',
                supportsSms: this._supportsSms
            });
            return;
        }

        console.log('[AuthHandler] Got SMS number.');
        this._providedSms.next(sms);
    }

    async cancelLogin() {
        console.log('[AuthHandler] Canceling login.');
        this._canceledLogins.next();
    }

    private _getTokenExpirationTime(token: string) {
        const [proof, claimJson] = JSON.parse(atob(token));
        const claim = JSON.parse(claimJson);
        return claim.ext;
    }

    private _nowInSeconds() {
        return Math.floor(Date.now() / 1000);
    }

    private async _checkLoginStatus() {
        console.log('[AuthHandler] Checking login status...');
        const loggedIn = await authManager.magic.user.isLoggedIn();
        console.log('[AuthHandler] Login result:', loggedIn);

        if (loggedIn && !authManager.userInfoLoaded) {
            await authManager.loadUserInfo();
        }
        return loggedIn;
    }

    private async _loadUserInfo() {
        if (!authManager.userInfoLoaded) {
            await authManager.loadUserInfo();
        }
        authManager.loadUserInfo;
        this._token = authManager.idToken;
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
            page: 'enter_email',
            termsOfServiceUrl: this.termsOfServiceUrl,
            siteName: this.siteName,
            supportsSms: this._supportsSms
        });

        const loginPromise = await new Promise((resolve, reject) => {
            let sub = this._providedEmails.subscribe(async (email) => {
                if (cancelSignal.canceled) {
                    sub.unsubscribe();
                    return resolve(null);
                }
                const promiEvent = authManager.magic.auth.loginWithMagicLink({
                    email: email,
                    showUI: false,
                });

                promiEvent.on('email-sent', () => {
                    console.log('[AuthHandler] Email sent.');
                    this._loginUIStatus.next({
                        page: 'check_email',
                    });
                    sub.unsubscribe();
                    resolve(promiEvent);
                });
                promiEvent.on('email-not-deliverable', () => {
                    console.log('[AuthHandler] Unable to send email.');
                    this._loginUIStatus.next({
                        page: 'enter_email',
                        siteName: this.siteName,
                        termsOfServiceUrl: this.termsOfServiceUrl,
                        showInvalidEmailError: true,
                        errorCode: 'invalid_email',
                        errorMessage:
                            'Unable to send an email to the provided email address.',
                        supportsSms: this._supportsSms
                    });
                });
            });

            sub.add(this._providedSms.subscribe(async (sms) => {
                if (cancelSignal.canceled) {
                    sub.unsubscribe();
                    return resolve(null);
                }

                try {
                    const promiEvent = authManager.magic.auth.loginWithSMS({
                        phoneNumber: sms
                    });
                    this._loginUIStatus.next({
                        page: 'show_iframe'
                    });

                    const result = await promiEvent;

                    sub.unsubscribe();
                    resolve(result);
                } catch(err) {
                    console.log('[AuthHandler] Unable to send SMS.', err);
                    this._loginUIStatus.next({
                        page: 'enter_email',
                        siteName: this.siteName,
                        termsOfServiceUrl: this.termsOfServiceUrl,
                        showInvalidSmsError: true,
                        errorCode: 'invalid_sms',
                        errorMessage:
                            'Unable to send a SMS message to the provided phone number.',
                        supportsSms: this._supportsSms
                    });
                    reject(err);
                }
            }));
        });

        if (!loginPromise) {
            return null;
        }

        try {
            await loginPromise;
        } catch (err) {
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
        const now = this._nowInSeconds();
        const lifetimeSeconds = expiry - now;

        const refreshTime = lifetimeSeconds - REFRESH_BUFFER_SECONDS;

        console.log(
            '[AuthHandler] Refreshing token in',
            refreshTime,
            'seconds'
        );

        this._refreshTimeout = setTimeout(() => {
            this._refreshToken();
        }, refreshTime * 1000);
    }

    private async _refreshToken() {
        try {
            console.log('[AuthHandler] Refreshing token...');

            if (!this._loginData) {
                console.log('[AuthHandler] Unable to refresh. No login data.');
                return;
            }

            const token = await authManager.magic.user.getIdToken();
            this._token = token;

            console.log('[AuthHandler] Token refreshed!');
            this._refreshTimeout = null;
            this._queueTokenRefresh(token);
        } catch (ex) {
            console.error('[AuthHandler] Failed to refresh token.', ex);
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
