import {
    AuxAuth,
    LoginStatus,
    LoginUIAddressStatus,
    LoginUIStatus,
    PrivoSignUpInfo,
} from '@casual-simulation/aux-vm';
import { AuthData } from '@casual-simulation/aux-common';
import {
    listenForChannel,
    listenForChannels,
    setupChannel,
    waitForLoad,
} from '../../../../aux-vm-browser/html/IFrameHelpers';
import { authManager } from '../shared/index';
import {
    CompleteOpenIDLoginSuccess,
    CreatePublicRecordKeyResult,
    IsValidDisplayNameResult,
    IsValidEmailAddressResult,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-records';
import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';
import {
    BehaviorSubject,
    Subject,
    merge,
    from,
    NEVER,
    firstValueFrom,
} from 'rxjs';
import {
    first,
    map,
    tap,
    share,
    filter,
    switchMap,
    mergeAll,
} from 'rxjs/operators';
import { DateTime } from 'luxon';

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
    private _connectionKey: string;
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
    private _providedHasAccount: Subject<boolean> = new Subject();
    private _providedPrivoSignUpInfo: Subject<PrivoSignUpInfo> = new Subject();

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

    async logout(): Promise<void> {
        await authManager.logout();
        this._loggedIn = false;
        this._loginData = null;
        this._loginStatus.next({});
        this._loginUIStatus.next({
            page: false,
        });
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

    async getConnectionKey(): Promise<string> {
        if (await this.isLoggedIn()) {
            return this._connectionKey;
        }

        return null;
    }

    async getProtocolVersion() {
        return 9;
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
        acceptedTermsOfService: boolean,
        collectionReason?: LoginUIAddressStatus['collectionReason']
    ): Promise<void> {
        if (!acceptedTermsOfService) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                privacyPolicyUrl: this.privacyPolicyUrl,
                showAcceptTermsOfServiceError: true,
                errorCode: 'terms_not_accepted',
                errorMessage: 'You must accept the terms of service.',
                supportsSms: this._supportsSms,
                collectionReason,
            });
            return;
        }
        if (!email) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                privacyPolicyUrl: this.privacyPolicyUrl,
                showEnterEmailError: true,
                errorCode: 'email_not_provided',
                errorMessage: 'You must provide an email address.',
                supportsSms: this._supportsSms,
                collectionReason,
            });
            return;
        }
        if (!(await authManager.validateEmail(email))) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                privacyPolicyUrl: this.privacyPolicyUrl,
                showInvalidEmailError: true,
                errorCode: 'invalid_email',
                errorMessage: 'The provided email is not accepted.',
                supportsSms: this._supportsSms,
                collectionReason,
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
                privacyPolicyUrl: this.privacyPolicyUrl,
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
                privacyPolicyUrl: this.privacyPolicyUrl,
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
                privacyPolicyUrl: this.privacyPolicyUrl,
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
                privacyPolicyUrl: this.privacyPolicyUrl,
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

    async isValidEmailAddress(
        email: string
    ): Promise<IsValidEmailAddressResult> {
        return await authManager.isValidEmailAddress(email);
    }

    async isValidDisplayName(
        displayName: string
    ): Promise<IsValidDisplayNameResult> {
        return await authManager.isValidDisplayName(displayName);
    }

    async provideCode(code: string): Promise<void> {
        console.log('[AuthHandler] Got login code.');
        this._providedCodes.next(code);
    }

    async provideHasAccount(hasAccount: boolean): Promise<void> {
        console.log('[AuthHandler] Has account:', hasAccount);
        this._providedHasAccount.next(hasAccount);
    }

    async providePrivoSignUpInfo(info: PrivoSignUpInfo): Promise<void> {
        if (!info.displayName) {
            this._loginUIStatus.next({
                page: 'enter_privo_account_info',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                privacyPolicyUrl: this.privacyPolicyUrl,
                showEnterDisplayNameError: true,
                errorCode: 'display_name_not_provided',
                errorMessage: 'You must provide a display name.',
            });
            return;
        }
        if (!info.name) {
            this._loginUIStatus.next({
                page: 'enter_privo_account_info',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                privacyPolicyUrl: this.privacyPolicyUrl,
                showEnterNameError: true,
                errorCode: 'name_not_provided',
                errorMessage: 'You must provide a name.',
            });
            return;
        }
        if (!info.dateOfBirth) {
            this._loginUIStatus.next({
                page: 'enter_privo_account_info',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                privacyPolicyUrl: this.privacyPolicyUrl,
                showEnterDateOfBirthError: true,
                errorCode: 'date_of_birth_not_provided',
                errorMessage: 'You must provide a Birth Date.',
            });
            return;
        }
        const dob = DateTime.fromJSDate(info.dateOfBirth);
        if (dob > DateTime.now()) {
            this._loginUIStatus.next({
                page: 'enter_privo_account_info',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                privacyPolicyUrl: this.privacyPolicyUrl,
                showInvalidDateOfBirthError: true,
                errorCode: 'invalid_date_of_birth',
                errorMessage: 'Your Birth Date cannot be in the future.',
            });
            return;
        }
        if (Math.abs(dob.diffNow('years').as('years')) < 18) {
            if (!info.parentEmail) {
                this._loginUIStatus.next({
                    page: 'enter_privo_account_info',
                    siteName: this.siteName,
                    termsOfServiceUrl: this.termsOfServiceUrl,
                    privacyPolicyUrl: this.privacyPolicyUrl,
                    showEnterParentEmailError: true,
                    errorCode: 'parent_email_required',
                    errorMessage: 'You must enter a parent email address.',
                });
                return;
            }
        } else {
            if (!info.email) {
                this._loginUIStatus.next({
                    page: 'enter_privo_account_info',
                    siteName: this.siteName,
                    termsOfServiceUrl: this.termsOfServiceUrl,
                    privacyPolicyUrl: this.privacyPolicyUrl,
                    showEnterEmailError: true,
                    errorCode: 'email_not_provided',
                    errorMessage: 'You must provide an email address.',
                });
                return;
            }
            if (!info.acceptedTermsOfService) {
                this._loginUIStatus.next({
                    page: 'enter_privo_account_info',
                    siteName: this.siteName,
                    termsOfServiceUrl: this.termsOfServiceUrl,
                    privacyPolicyUrl: this.privacyPolicyUrl,
                    showAcceptTermsOfServiceError: true,
                    errorCode: 'terms_not_accepted',
                    errorMessage: 'You must accept the terms of service.',
                });
                return;
            }
        }

        if (info.email) {
            if (!(await authManager.validateEmail(info.email))) {
                this._loginUIStatus.next({
                    page: 'enter_privo_account_info',
                    siteName: this.siteName,
                    termsOfServiceUrl: this.termsOfServiceUrl,
                    privacyPolicyUrl: this.privacyPolicyUrl,
                    showInvalidEmailError: true,
                    errorCode: 'invalid_email',
                    errorMessage: 'The provided email is not accepted.',
                });
                return;
            }
        }

        if (info.parentEmail) {
            if (!(await authManager.validateEmail(info.parentEmail))) {
                this._loginUIStatus.next({
                    page: 'enter_privo_account_info',
                    siteName: this.siteName,
                    termsOfServiceUrl: this.termsOfServiceUrl,
                    privacyPolicyUrl: this.privacyPolicyUrl,
                    showInvalidParentEmailError: true,
                    errorCode: 'invalid_parent_email',
                    errorMessage: 'The provided email is not accepted.',
                });
                return;
            }
        }

        console.log('[AuthHandler] Got Privo sign up info.');
        this._providedPrivoSignUpInfo.next({
            ...info,
        });
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
        this._token = authManager.savedSessionKey;
        this._connectionKey = authManager.savedConnectionKey;
        this._loginData = {
            userId: this._userId ?? authManager.userId,
            avatarUrl: authManager.avatarUrl,
            avatarPortraitUrl: authManager.avatarPortraitUrl,
            name: authManager.name,
            displayName: authManager.displayName,
            hasActiveSubscription: authManager.hasActiveSubscription,
            subscriptionTier: authManager.subscriptionTier,
            privacyFeatures: authManager.privacyFeatures,
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
        if (authManager.usePrivoLogin) {
            return this._privoLoginWithCustomUI(cancelSignal);
        } else {
            return this._regularLoginWithCustomUI(cancelSignal);
        }
    }

    private async _regularLoginWithCustomUI(cancelSignal: {
        canceled: boolean;
    }): Promise<string> {
        this._loginUIStatus.next({
            page: 'enter_address',
            termsOfServiceUrl: this.termsOfServiceUrl,
            privacyPolicyUrl: this.privacyPolicyUrl,
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
                        enterCode: true,
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
                                        enterCode: true,
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
                            privacyPolicyUrl: this.privacyPolicyUrl,
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
                            privacyPolicyUrl: this.privacyPolicyUrl,
                            showInvalidEmailError: true,
                            errorCode: 'invalid_email',
                            errorMessage: 'Email addresses are not supported',
                            supportsSms: this._supportsSms,
                        });
                    } else if (result.errorCode === 'user_is_banned') {
                        this._loginUIStatus.next({
                            page: 'enter_address',
                            siteName: this.siteName,
                            termsOfServiceUrl: this.termsOfServiceUrl,
                            privacyPolicyUrl: this.privacyPolicyUrl,
                            showBannedUserError: true,
                            errorCode: 'user_is_banned',
                            errorMessage: result.errorMessage,
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

    private async _privoLoginWithCustomUI(cancelSignal: {
        canceled: boolean;
    }): Promise<string> {
        this._loginUIStatus.next({
            page: 'has_account',
            privacyPolicyUrl: this.privacyPolicyUrl,
        });

        const hasAccount = await firstValueFrom(
            this._providedHasAccount.pipe(filter(() => !cancelSignal.canceled))
        );

        if (hasAccount) {
            // redirect to privo login
            return await this._loginWithPrivo(cancelSignal);
        } else {
            return await this._registerWithPrivo(cancelSignal);
        }
    }

    private async _loginWithPrivo(cancelSignal: {
        canceled: boolean;
    }): Promise<string> {
        const result = await authManager.loginWithPrivo();
        if (result.success) {
            const requestId = result.requestId;
            const newTab = window.open(result.authorizationUrl, '_blank');

            const codes: CompleteOpenIDLoginSuccess =
                await new Promise<CompleteOpenIDLoginSuccess>(
                    (resolve, reject) => {
                        let intervalId: number | NodeJS.Timer;
                        const handleClose = async () => {
                            if (intervalId) {
                                clearInterval(intervalId);
                            }

                            const loginResult =
                                await authManager.completeOAuthLogin(requestId);

                            if (loginResult.success === true) {
                                resolve(loginResult);
                            } else {
                                if (loginResult.errorCode === 'not_completed') {
                                    reject(new Error('Login canceled.'));
                                } else {
                                    reject(new Error('Login failed.'));
                                }
                            }
                        };

                        intervalId = setInterval(() => {
                            if (newTab.closed) {
                                console.error('Closed!');
                                handleClose();
                            }
                        }, 500);
                    }
                );

            await authManager.loadUserInfo();
            await this._loadUserInfo();

            return authManager.userId;
        }
        return null;
    }

    private async _registerWithPrivo(cancelSignal: {
        canceled: boolean;
    }): Promise<string> {
        // ask for registration info
        this._loginUIStatus.next({
            page: 'enter_privo_account_info',
            termsOfServiceUrl: this.termsOfServiceUrl,
            privacyPolicyUrl: this.privacyPolicyUrl,
            siteName: this.siteName,
        });

        while (!cancelSignal.canceled) {
            const info = await firstValueFrom(
                this._providedPrivoSignUpInfo.pipe(
                    filter(() => !cancelSignal.canceled)
                )
            );

            const result = await authManager.signUpWithPrivo({
                acceptedTermsOfService: info.acceptedTermsOfService,
                displayName: info.displayName,
                email: info.email,
                name: info.name,
                dateOfBirth: info.dateOfBirth,
                parentEmail: info.parentEmail,
            });

            if (result.success === false) {
                console.log(
                    '[AuthHandler] Failed to sign up with Privo.',
                    result
                );
                continue;
            }

            await authManager.loadUserInfo();
            await this._loadUserInfo();

            this._loginUIStatus.next({
                page: 'show_update_password_link',
                updatePasswordUrl: result.updatePasswordUrl,
            });

            return authManager.userId;
        }
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

    private get privacyPolicyUrl() {
        return new URL('/privacy-policy', location.origin).href;
    }

    private get _supportsSms() {
        return ENABLE_SMS_AUTHENTICATION === true;
    }
}

interface ProvidedPrivoInfo {
    email: string;
    name: string | undefined | null;
    dateOfBirth: Date | undefined | null;
}
