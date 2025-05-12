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
import type {
    AuxAuth,
    LoginHint,
    LoginStatus,
    LoginUIStatus,
    OAuthRedirectRequest,
    PolicyUrls,
    PrivoSignUpInfo,
} from '@casual-simulation/aux-vm';
import type {
    AuthData,
    AvailablePermissions,
    RemoteCausalRepoProtocol,
} from '@casual-simulation/aux-common';
import { listenForChannels } from '../../../../aux-vm-browser/html/IFrameHelpers';
import { authManager } from '../shared/index';
import type {
    CreatePublicRecordKeyResult,
    IsValidDisplayNameResult,
    IsValidEmailAddressResult,
    GetPlayerConfigResult,
    GrantMarkerPermissionResult,
    GrantResourcePermissionResult,
    CompleteLoginSuccess,
    CompleteWebAuthnLoginSuccess,
    ValidateSessionKeyFailure,
} from '@casual-simulation/aux-records';
import type { FormError } from '@casual-simulation/aux-common/forms';
import {
    getFormErrors,
    CODE_FIELD,
    DATE_OF_BIRTH_FIELD,
    DISPLAY_NAME_FIELD,
    EMAIL_FIELD,
    TERMS_OF_SERVICE_FIELD,
    NAME_FIELD,
    PARENT_EMAIL_FIELD,
    ADDRESS_FIELD,
} from '@casual-simulation/aux-common/forms';
import {
    canExpire,
    getSessionKeyExpiration,
    isExpired,
    timeUntilRefresh,
} from '@casual-simulation/aux-common';
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
    concatMap,
} from 'rxjs/operators';
import { DateTime } from 'luxon';
import { OAUTH_LOGIN_CHANNEL_NAME } from '../shared/AuthManager';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import type { PublicRecordKeyPolicy } from '@casual-simulation/aux-common/records/RecordKeys';

declare let ENABLE_SMS_AUTHENTICATION: boolean;

const CURRENT_PROTOCOL_VERSION = 12;

/**
 * Defines a class that implements the backend for an AuxAuth instance.
 */
export class AuthHandler implements AuxAuth {
    private _loggedIn: boolean = false;
    private _loginData: AuthData;
    private _userId: string;
    private _refreshTimeout: any;
    private _loginStatus: BehaviorSubject<LoginStatus> = new BehaviorSubject(
        {}
    );
    private _loginUIStatus: BehaviorSubject<LoginUIStatus> =
        new BehaviorSubject({ page: false });
    private _oauthRedirect: Subject<OAuthRedirectRequest> = new Subject();
    private _useCustomUI: boolean = false;
    private _providedEmails: Subject<string> = new Subject();
    private _providedSms: Subject<string> = new Subject();
    private _canceledLogins: Subject<void> = new Subject();
    private _providedCodes: Subject<string> = new Subject();
    private _providedHasAccount: Subject<boolean> = new Subject();
    private _providedPrivoSignUpInfo: Subject<PrivoSignUpInfo> = new Subject();
    private _providedLoginResults: Subject<
        CompleteLoginSuccess | CompleteWebAuthnLoginSuccess
    > = new Subject();
    private _oauthRedirectComplete: Subject<void> = new Subject();
    private _oauthChannel: BroadcastChannel = new BroadcastChannel(
        OAUTH_LOGIN_CHANNEL_NAME
    );
    private _initialized: boolean = false;
    private _initPromise: Promise<void> = null;

    private _loginPromise: Promise<AuthData>;
    private _isLoggingIn: boolean;

    constructor(sessionKey?: string, connectionKey?: string) {
        if (sessionKey && connectionKey) {
            authManager.useTemporaryKeys(sessionKey, connectionKey);
        }

        this._oauthChannel.addEventListener('message', (event) => {
            if (event.data === 'login') {
                console.log('[AuthHandler] Got oauth login message.');
                this._oauthRedirectComplete.next();
            }
        });
    }

    get connectionKey() {
        return authManager.currentConnectionKey;
    }

    get sessionKey() {
        return authManager.currentSessionKey;
    }

    async provideLoginResult(
        result: CompleteLoginSuccess | CompleteWebAuthnLoginSuccess
    ): Promise<void> {
        this._providedLoginResults.next(result);
    }

    async relogin(): Promise<AuthData> {
        if (!(await this.isLoggedIn())) {
            // login again
            return await this.login();
        }

        // check session validity
        const result = await authManager.client.getUserInfo({
            userId: authManager.userId,
        });

        if (result.success === false) {
            this._loggedIn = false;
            await authManager.logout(false);
            return await this.login();
        }

        return this._loginData;
    }

    private _init() {
        if (this._initPromise) {
            return this._initPromise;
        }
        return (this._initPromise = this._initAsync());
    }

    private async _initAsync() {
        if (this._initialized) {
            return;
        }
        this._initialized = true;

        console.log('[AuthHandler] Checking initial login status...');
        if (await this._checkLoginStatus()) {
            await this._loadUserInfo();
        }
    }

    async getPolicyUrls(): Promise<PolicyUrls> {
        return {
            privacyPolicyUrl: this.privacyPolicyUrl,
            termsOfServiceUrl: this.termsOfServiceUrl,
            codeOfConductUrl: this.codeOfConductUrl,
            supportUrl: this.supportUrl,
        };
    }

    async getComIdWebConfig(comId: string): Promise<GetPlayerConfigResult> {
        return authManager.client.getPlayerConfig({
            comId,
        });
    }

    async provideOAuthLoginComplete(): Promise<void> {
        this._oauthRedirectComplete.next();
    }

    async isLoggedIn(): Promise<boolean> {
        await this._init();
        if (this._loggedIn) {
            const expiry = getSessionKeyExpiration(this.sessionKey);
            if (!isExpired(expiry)) {
                return true;
            }
        }
        return false;
    }

    async login(
        backgroundLogin?: boolean,
        hint?: 'sign in' | 'sign up' | null
    ): Promise<AuthData> {
        if (await this.isLoggedIn()) {
            return this._loginData;
        }

        if (!backgroundLogin) {
            if (this._isLoggingIn) {
                console.log(
                    '[AuthHandler] Already logging in. Using existing login promise.'
                );
                return await this._loginPromise;
            }

            try {
                this._isLoggingIn = true;
                this._loginPromise = this._loginCore(backgroundLogin, hint);
                return await this._loginPromise;
            } finally {
                this._isLoggingIn = false;
            }
        } else {
            return await this._loginCore(backgroundLogin, hint);
        }
    }

    private async _loginCore(
        backgroundLogin?: boolean,
        hint?: 'sign in' | 'sign up' | null
    ) {
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
                userId = await this._loginWithCustomUI(hint);
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

        const key = await authManager.client.createRecordKey({
            recordName,
            policy,
        });
        console.log('[AuthHandler] Record key created.');

        if (key.success === false) {
            if (
                key.errorCode === 'not_logged_in' ||
                key.errorCode === 'unacceptable_session_key' ||
                key.errorCode === 'invalid_key' ||
                key.errorCode === 'session_expired'
            ) {
                this._loggedIn = false;
                await authManager.logout(false);
                return await this.createPublicRecordKey(recordName, policy);
            }
        }

        return key;
    }

    async getAuthToken(): Promise<string> {
        if (await this.isLoggedIn()) {
            return this.sessionKey;
        }

        return null;
    }

    async getConnectionKey(): Promise<string> {
        if (await this.isLoggedIn()) {
            return this.connectionKey;
        }

        return null;
    }

    async getProtocolVersion() {
        return CURRENT_PROTOCOL_VERSION;
    }

    async getRecordsOrigin(): Promise<string> {
        return Promise.resolve(authManager.apiEndpoint);
    }

    async getWebsocketOrigin(): Promise<string> {
        return Promise.resolve(authManager.websocketEndpoint);
    }

    async getWebsocketProtocol(): Promise<RemoteCausalRepoProtocol> {
        return Promise.resolve(authManager.websocketProtocol);
    }

    async openAccountPage(): Promise<void> {
        const url = await this.getAccountPage();
        window.open(url, '_blank');
    }

    async getAccountPage(): Promise<string> {
        const url = new URL('/', location.origin);
        if (
            authManager.currentSessionKey !== authManager.savedSessionKey &&
            authManager.currentConnectionKey !== authManager.savedConnectionKey
        ) {
            url.searchParams.set('sessionKey', authManager.currentSessionKey);
            url.searchParams.set(
                'connectionKey',
                authManager.currentConnectionKey
            );
        }
        return url.href;
    }

    async addLoginStatusCallback(
        callback: (status: LoginStatus) => void
    ): Promise<void> {
        this._loginStatus.subscribe((status) => callback(status));
    }

    async addLoginUICallback(callback: (status: LoginUIStatus) => void) {
        this._loginUIStatus.subscribe((status) => callback(status));
    }

    async addOAuthRedirectCallback(
        callback: (request: OAuthRedirectRequest) => void
    ): Promise<void> {
        this._oauthRedirect.subscribe((request) => callback(request));
    }

    async setUseCustomUI(useCustomUI: boolean) {
        this._useCustomUI = !!useCustomUI;
    }

    async provideEmailAddress(
        email: string,
        acceptedTermsOfService: boolean
    ): Promise<void> {
        const errors: FormError[] = [];

        if (!acceptedTermsOfService) {
            errors.push({
                for: TERMS_OF_SERVICE_FIELD,
                errorCode: 'terms_not_accepted',
                errorMessage: 'You must accept the terms of service.',
            });
        }
        if (!email) {
            errors.push({
                for: ADDRESS_FIELD,
                errorCode: 'email_not_provided',
                errorMessage: 'You must provide an email address.',
            });
        } else if (!(await authManager.validateEmail(email))) {
            errors.push({
                for: ADDRESS_FIELD,
                errorCode: 'invalid_email',
                errorMessage: 'The provided email is not accepted.',
            });
        }

        if (errors.length > 0) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                privacyPolicyUrl: this.privacyPolicyUrl,
                codeOfConductUrl: this.codeOfConductUrl,
                supportUrl: this.supportUrl,
                supportsSms: this._supportsSms,
                supportsWebAuthn: this._supportsWebAuthn,
                errors: errors,
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
        const errors: FormError[] = [];

        if (!acceptedTermsOfService) {
            errors.push({
                for: TERMS_OF_SERVICE_FIELD,
                errorCode: 'terms_not_accepted',
                errorMessage: 'You must accept the terms of service.',
            });
        }
        if (!sms) {
            errors.push({
                for: ADDRESS_FIELD,
                errorCode: 'sms_not_provided',
                errorMessage: 'You must provide an SMS number.',
            });
            return;
        } else {
            sms = sms.trim();
            if (!sms.startsWith('+')) {
                errors.push({
                    for: ADDRESS_FIELD,
                    errorCode: 'invalid_sms',
                    errorMessage:
                        'The phone number must include the country code.',
                });
            } else if (!(await authManager.validateSmsNumber(sms))) {
                errors.push({
                    for: ADDRESS_FIELD,
                    errorCode: 'invalid_sms',
                    errorMessage: 'The provided phone number is not accepted.',
                });
            }
        }

        if (errors.length > 0) {
            this._loginUIStatus.next({
                page: 'enter_address',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                privacyPolicyUrl: this.privacyPolicyUrl,
                codeOfConductUrl: this.codeOfConductUrl,
                supportUrl: this.supportUrl,
                supportsSms: this._supportsSms,
                supportsWebAuthn: this._supportsWebAuthn,
                errors: errors,
            });
            return;
        }

        console.log('[AuthHandler] Got SMS number.');
        this._providedSms.next(sms);
    }

    async isValidEmailAddress(
        email: string
    ): Promise<IsValidEmailAddressResult> {
        return await authManager.client.isEmailValid({
            email,
        });
    }

    async isValidDisplayName(
        displayName: string,
        name: string
    ): Promise<IsValidDisplayNameResult> {
        return await authManager.client.isDisplayNameValid({
            displayName,
            name,
        });
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
        const errors: FormError[] = [];

        if (!info.displayName) {
            errors.push({
                for: DISPLAY_NAME_FIELD,
                errorCode: 'display_name_not_provided',
                errorMessage: 'You must provide a display name.',
            });
        }
        if (!info.name) {
            errors.push({
                for: NAME_FIELD,
                errorCode: 'name_not_provided',
                errorMessage: 'You must provide a name.',
            });
        }
        if (!info.dateOfBirth) {
            errors.push({
                for: DATE_OF_BIRTH_FIELD,
                errorCode: 'date_of_birth_not_provided',
                errorMessage: 'You must provide a Birth Date.',
            });
        } else {
            const dob = DateTime.fromJSDate(info.dateOfBirth);
            if (dob > DateTime.now()) {
                errors.push({
                    for: DATE_OF_BIRTH_FIELD,
                    errorCode: 'invalid_date_of_birth',
                    errorMessage: 'Your Birth Date cannot be in the future.',
                });
            }
            if (Math.abs(dob.diffNow('years').as('years')) < 18) {
                if (!info.parentEmail) {
                    errors.push({
                        for: PARENT_EMAIL_FIELD,
                        errorCode: 'parent_email_required',
                        errorMessage: 'You must enter a parent email address.',
                    });
                }
            } else {
                if (!info.email) {
                    errors.push({
                        for: EMAIL_FIELD,
                        errorCode: 'email_not_provided',
                        errorMessage: 'You must provide an email address.',
                    });
                }

                if (!info.acceptedTermsOfService) {
                    errors.push({
                        for: TERMS_OF_SERVICE_FIELD,
                        errorCode: 'terms_not_accepted',
                        errorMessage: 'You must accept the terms of service.',
                    });
                }
            }
        }

        if (info.displayName && info.name) {
            const validDisplayName =
                await authManager.client.isDisplayNameValid({
                    displayName: info.displayName,
                    name: info.name,
                });
            if (validDisplayName.success === false) {
                errors.push(...getFormErrors(validDisplayName));
            } else if (!validDisplayName.allowed) {
                if (validDisplayName.containsName) {
                    errors.push({
                        for: DISPLAY_NAME_FIELD,
                        errorCode: 'invalid_display_name',
                        errorMessage:
                            'The display name cannot contain your name.',
                    });
                } else {
                    errors.push({
                        for: DISPLAY_NAME_FIELD,
                        errorCode: 'invalid_display_name',
                        errorMessage:
                            'This display name is either not allowed or already taken.',
                    });
                }
            }
        }

        if (info.email) {
            if (!(await authManager.validateEmail(info.email))) {
                errors.push({
                    for: EMAIL_FIELD,
                    errorCode: 'invalid_email',
                    errorMessage: 'This email is already taken.',
                });
            }
        }

        if (info.parentEmail) {
            if (!(await authManager.validateEmail(info.parentEmail, true))) {
                errors.push({
                    for: PARENT_EMAIL_FIELD,
                    errorCode: 'invalid_parent_email',
                    errorMessage:
                        'The provided email must be a valid email address.',
                });
            }
        }

        if (errors.length > 0) {
            this._loginUIStatus.next({
                page: 'enter_privo_account_info',
                siteName: this.siteName,
                termsOfServiceUrl: this.termsOfServiceUrl,
                privacyPolicyUrl: this.privacyPolicyUrl,
                codeOfConductUrl: this.codeOfConductUrl,
                supportUrl: this.supportUrl,
                errors: errors,
            });
            return;
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

    async grantPermission(
        recordName: string,
        permission: AvailablePermissions
    ): Promise<
        | GrantMarkerPermissionResult
        | GrantResourcePermissionResult
        | ValidateSessionKeyFailure
    > {
        return await authManager.client.grantPermission({
            recordName,
            permission,
        });
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

        this._queueTokenRefresh(this.sessionKey);
        this._loggedIn = true;
        console.log('[AuthHandler] Logged In!');

        this._loginStatus.next({
            authData: this._loginData,
        });
    }

    private async _loginWithCustomUI(hint: LoginHint): Promise<string> {
        try {
            let canceled = firstValueFrom(
                this._canceledLogins.pipe(
                    first(),
                    map(() => null as string)
                )
            );
            let cancelSignal = {
                canceled: false,
            };
            canceled.then((): string => {
                cancelSignal.canceled = true;
                return null;
            });

            const userId = await Promise.race<string>([
                canceled,
                this._tryLoginWithCustomUI(hint, cancelSignal),
            ]);

            if (!userId) {
                this._loginUIStatus.next({
                    page: false,
                });
            }

            return userId;
        } catch (err) {
            console.error(
                '[AuthHandler] Error logging in with custom UI.',
                err
            );
            this._loginUIStatus.next({
                page: false,
            });
        }
    }

    private async _tryLoginWithCustomUI(
        hint: LoginHint,
        cancelSignal: {
            canceled: boolean;
        }
    ): Promise<string> {
        if (authManager.usePrivoLogin) {
            return this._privoLoginWithCustomUI(hint, cancelSignal);
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
            codeOfConductUrl: this.codeOfConductUrl,
            supportUrl: this.supportUrl,
            siteName: this.siteName,
            supportsSms: this._supportsSms,
            supportsWebAuthn: this._supportsWebAuthn,
            errors: [],
        });

        const userId = await Promise.race([
            this._regularLoginWithProvidedLogin(cancelSignal),
            this._regularLoginWithCustomUICore(cancelSignal),
        ]);

        return userId;
    }

    private async _regularLoginWithProvidedLogin(cancelSignal: {
        canceled: boolean;
    }): Promise<string> {
        const loginResults = this._providedLoginResults.pipe(
            filter(() => !cancelSignal.canceled)
        );

        const result = await firstValueFrom(loginResults);

        if (cancelSignal.canceled) {
            return;
        }

        authManager.updateLoginStateFromResult(result);
        await authManager.loadUserInfo();
        await this._loadUserInfo();

        this._loginUIStatus.next({
            page: false,
        });

        return authManager.userId;
    }

    private async _regularLoginWithCustomUICore(cancelSignal: {
        canceled: boolean;
    }): Promise<string> {
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
            concatMap((result) => {
                if (result.success === true) {
                    const address = result.address;
                    const addressType = result.addressType;
                    console.log('[AuthHandler] Email sent.');
                    this._loginUIStatus.next({
                        page: 'check_address',
                        address: result.address,
                        addressType: result.addressType,
                        enterCode: true,
                        errors: [],
                        supportUrl: this.supportUrl,
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
                                        errors: [
                                            {
                                                for: CODE_FIELD,
                                                errorCode: result.errorCode,
                                                errorMessage:
                                                    result.errorMessage,
                                            },
                                        ],
                                        supportUrl: this.supportUrl,
                                    });
                                }
                            }
                        })
                    );
                } else {
                    console.log('[AuthHandler] Unable to send email.');
                    const errors = getFormErrors(result);
                    this._loginUIStatus.next({
                        page: 'enter_address',
                        siteName: this.siteName,
                        termsOfServiceUrl: this.termsOfServiceUrl,
                        privacyPolicyUrl: this.privacyPolicyUrl,
                        codeOfConductUrl: this.codeOfConductUrl,
                        supportUrl: this.supportUrl,
                        errors: errors,
                        supportsSms: this._supportsSms,
                        supportsWebAuthn: this._supportsWebAuthn,
                    });

                    return NEVER;
                }
            }),
            first((result) => result.success)
        );

        const login = await firstValueFrom(logins);

        if (login.success === false) {
            return null;
        }

        await authManager.loadUserInfo();
        await this._loadUserInfo();

        let showingInterstital = false;

        if (!cancelSignal.canceled && login.metadata) {
            showingInterstital = true;
            this._loginUIStatus.next({
                page: 'handle_login_metadata',
                metadata: login.metadata,
                method: 'code',
                apiEndpoint: authManager.apiEndpoint,
                authenticationHeaders: authManager.getAuthenticationHeaders(),
            });
        }

        if (!showingInterstital) {
            this._loginUIStatus.next({
                page: false,
            });
        }

        return authManager.userId;
    }

    private async _privoLoginWithCustomUI(
        hint: LoginHint,
        cancelSignal: {
            canceled: boolean;
        }
    ): Promise<string> {
        if (hint === 'sign in') {
            console.log(
                '[AuthHandler] Hint: sign in. Logging in with Privo...'
            );
            return await this._loginWithPrivo(cancelSignal);
        } else if (hint === 'sign up') {
            console.log(
                '[AuthHandler] Hint: sign up. Registering with Privo...'
            );
            return await this._registerWithPrivo(cancelSignal);
        } else {
            this._loginUIStatus.next({
                page: 'has_account',
                privacyPolicyUrl: this.privacyPolicyUrl,
                codeOfConductUrl: this.codeOfConductUrl,
                termsOfServiceUrl: this.termsOfServiceUrl,
                supportUrl: this.supportUrl,
            });

            const hasAccount = await firstValueFrom(
                this._providedHasAccount.pipe(
                    filter(() => !cancelSignal.canceled)
                )
            );

            if (hasAccount) {
                // redirect to privo login
                return await this._loginWithPrivo(cancelSignal);
            } else {
                return await this._registerWithPrivo(cancelSignal);
            }
        }
    }

    private async _loginWithPrivo(cancelSignal: {
        canceled: boolean;
    }): Promise<string> {
        const result = await authManager.loginWithPrivo();
        if (result.success) {
            const requestId = result.requestId;

            this._oauthRedirect.next({
                authorizationUrl: result.authorizationUrl,
            });

            await firstValueFrom(this._oauthRedirectComplete);

            const loginResult = await authManager.completeOAuthLogin(requestId);

            if (loginResult.success === false) {
                if (loginResult.errorCode === 'not_completed') {
                    throw new Error('Login canceled.');
                } else {
                    throw new Error('Login failed.');
                }
            }

            await authManager.loadUserInfo();
            await this._loadUserInfo();

            this._loginUIStatus.next({
                page: false,
            });

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
            codeOfConductUrl: this.codeOfConductUrl,
            supportUrl: this.supportUrl,
            siteName: this.siteName,
            errors: [],
        });

        while (!cancelSignal.canceled) {
            const info = await firstValueFrom(
                this._providedPrivoSignUpInfo.pipe(
                    filter(() => !cancelSignal.canceled)
                )
            );

            let updatePasswordUrl: string;
            try {
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

                    const errors = getFormErrors(result);

                    this._loginUIStatus.next({
                        page: 'enter_privo_account_info',
                        termsOfServiceUrl: this.termsOfServiceUrl,
                        privacyPolicyUrl: this.privacyPolicyUrl,
                        codeOfConductUrl: this.codeOfConductUrl,
                        supportUrl: this.supportUrl,
                        siteName: this.siteName,
                        errors: errors,
                    });
                    continue;
                }
                updatePasswordUrl = result.updatePasswordUrl;
            } catch (err) {
                console.error(
                    '[AuthHandler] Error signing up with Privo.',
                    err
                );
                this._loginUIStatus.next({
                    page: 'enter_privo_account_info',
                    termsOfServiceUrl: this.termsOfServiceUrl,
                    privacyPolicyUrl: this.privacyPolicyUrl,
                    codeOfConductUrl: this.codeOfConductUrl,
                    supportUrl: this.supportUrl,
                    siteName: this.siteName,
                    errors: [
                        {
                            for: null,
                            errorCode: 'server_error',
                            errorMessage:
                                'An error occurred. Please try again later.',
                        },
                    ],
                });
                continue;
            }

            await authManager.loadUserInfo();
            await this._loadUserInfo();

            this._loginUIStatus.next({
                page: 'show_update_password_link',
                updatePasswordUrl: updatePasswordUrl,
                providedParentEmail: !!info.parentEmail,
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
        const expiry = getSessionKeyExpiration(token);

        if (!canExpire(expiry)) {
            console.log('[AuthHandler] Token does not expire.');
            return;
        }

        const refreshTimeMs = timeUntilRefresh(expiry);
        if (refreshTimeMs <= 0) {
            // refresh now
            this._refreshToken();
        } else {
            // refresh in the future
            console.log(
                '[AuthHandler] Refreshing token in',
                refreshTimeMs / 1000,
                'seconds'
            );
            this._refreshTimeout = setTimeout(() => {
                this._refreshToken();
            }, refreshTimeMs);
        }
    }

    private async _refreshToken() {
        console.log('[AuthHandler] Refreshing token...');
        if (!this._loginData) {
            console.log('[AuthHandler] Unable to refresh. No login data.');
            return;
        }
        const result = await authManager.replaceSession();
        if (result.success) {
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

    private get codeOfConductUrl() {
        return new URL('/code-of-conduct', location.origin).href;
    }

    private get supportUrl() {
        return authManager.supportUrl;
    }

    private get _supportsSms() {
        return ENABLE_SMS_AUTHENTICATION === true;
    }

    private get _supportsWebAuthn() {
        return browserSupportsWebAuthn();
    }
}
