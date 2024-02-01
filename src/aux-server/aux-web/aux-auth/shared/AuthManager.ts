import axios from 'axios';
import { Subject, BehaviorSubject, Observable, from } from 'rxjs';
import { AppMetadata } from '../../../aux-backend/shared/AuthMetadata';
import type {
    CreatePublicRecordKeyResult,
    PublicRecordKeyPolicy,
    ListDataResult,
    ListedRecord,
    ListRecordsResult,
    ListFilesResult,
    EraseFileResult,
    EraseDataResult,
    ListUserPoliciesResult,
    ListEventsResult,
    ListRoleAssignmentsResult,
    ListStudiosResult,
    ListedStudio,
    Studio,
    CreateStudioResult,
    ListedStudioMember,
    ListStudioMembersResult,
    AddStudioMemberRequest,
    AddStudioMemberResult,
    RemoveStudioMemberRequest,
    RemoveStudioMemberResult,
    CreateRecordRequest,
    CreateRecordResult,
    ListInstsResult,
    EraseInstResult,
    GetStudioResult,
    UpdateStudioRequest,
    UpdateStudioResult,
    ComIdRequestResult,
    GetPlayerConfigResult,
} from '@casual-simulation/aux-records';
import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';
import type {
    CompleteLoginResult,
    LoginRequestResult,
    ListSessionsResult,
    RevokeSessionResult,
    RevokeAllSessionsResult,
    ListedSession,
    ReplaceSessionResult,
    PrivoSignUpRequestResult,
    OpenIDLoginRequestResult,
    ProcessOpenIDAuthorizationCodeRequest,
    ProcessOpenIDAuthorizationCodeResult,
    CompleteOpenIDLoginResult,
    IsValidEmailAddressResult,
    IsValidDisplayNameResult,
} from '@casual-simulation/aux-records/AuthController';
import { AddressType } from '@casual-simulation/aux-records/AuthStore';
import type {
    GetSubscriptionStatusResult,
    SubscriptionStatus,
    CreateManageSubscriptionResult,
    GetSubscriptionStatusSuccess,
    CreateManageSubscriptionRequest,
    GetSubscriptionStatusRequest,
} from '@casual-simulation/aux-records/SubscriptionController';
import { omitBy } from 'lodash';
import { PrivoSignUpInfo } from '@casual-simulation/aux-vm';
import type { RemoteCausalRepoProtocol } from '@casual-simulation/aux-common';

const EMAIL_KEY = 'userEmail';
const ACCEPTED_TERMS_KEY = 'acceptedTerms';
const SESSION_KEY = 'sessionKey';
const CONNECTION_KEY = 'connectionKey';
export const OAUTH_LOGIN_CHANNEL_NAME = 'aux-login-oauth';

declare const ASSUME_SUBSCRIPTIONS_SUPPORTED: boolean;

if (typeof (globalThis as any).ASSUME_SUBSCRIPTIONS_SUPPORTED === 'undefined') {
    (globalThis as any).ASSUME_SUBSCRIPTIONS_SUPPORTED = false;
}

console.log(
    `[AuthManager] Assume subscriptions supported: ${ASSUME_SUBSCRIPTIONS_SUPPORTED}`
);

declare const ASSUME_STUDIOS_SUPPORTED: boolean;

if (typeof (globalThis as any).ASSUME_STUDIOS_SUPPORTED === 'undefined') {
    (globalThis as any).ASSUME_STUDIOS_SUPPORTED = false;
}

console.log(
    `[AuthManager] Assume studios supported: ${ASSUME_STUDIOS_SUPPORTED}`
);

declare const USE_PRIVO_LOGIN: boolean;

if (typeof (globalThis as any).USE_PRIVO_LOGIN === 'undefined') {
    (globalThis as any).USE_PRIVO_LOGIN = false;
}

console.log(`[AuthManager] Use Privo Login: ${USE_PRIVO_LOGIN}`);

export class AuthManager {
    private _userId: string;
    private _sessionId: string;
    private _appMetadata: AppMetadata;
    private _subscriptionsSupported: boolean;
    private _studiosSupported: boolean;
    private _usePrivoLogin: boolean;

    private _loginState: Subject<boolean>;
    private _apiEndpoint: string;
    private _websocketEndpoint: string;
    private _websocketProtocol: RemoteCausalRepoProtocol;
    private _gitTag: string;

    constructor(
        apiEndpoint: string,
        websocketEndpoint: string,
        websocketProtocol: RemoteCausalRepoProtocol,
        gitTag: string
    ) {
        this._apiEndpoint = apiEndpoint;
        this._websocketEndpoint = websocketEndpoint;
        this._websocketProtocol = websocketProtocol;
        this._gitTag = gitTag;
        this._loginState = new BehaviorSubject<boolean>(false);
        this._subscriptionsSupported = ASSUME_SUBSCRIPTIONS_SUPPORTED;
        this._studiosSupported = ASSUME_STUDIOS_SUPPORTED;
        this._usePrivoLogin = USE_PRIVO_LOGIN;
    }

    get userId() {
        return this._userId;
    }

    get sessionId() {
        return this._sessionId;
    }

    get email() {
        return this._appMetadata?.email;
    }

    get phone() {
        return this._appMetadata?.phoneNumber;
    }

    get avatarUrl() {
        return this._appMetadata?.avatarUrl;
    }

    get avatarPortraitUrl() {
        return this._appMetadata?.avatarPortraitUrl;
    }

    get name() {
        return this._appMetadata?.name;
    }

    get displayName() {
        return this._appMetadata?.displayName;
    }

    get privacyFeatures() {
        return this._appMetadata?.privacyFeatures;
    }

    get subscriptionsSupported() {
        return this._subscriptionsSupported;
    }

    get hasActiveSubscription() {
        return this._appMetadata?.hasActiveSubscription;
    }

    get subscriptionTier() {
        return this._appMetadata?.subscriptionTier;
    }

    get studiosSupported() {
        return this._studiosSupported;
    }

    get usePrivoLogin() {
        return this._usePrivoLogin;
    }

    get userInfoLoaded() {
        return !!this._userId && !!this.savedSessionKey && !!this._appMetadata;
    }

    get loginState(): Observable<boolean> {
        return this._loginState;
    }

    /**
     * Determines if the given email address is valid.
     * @param email The email address to check.
     * @param structureOnly Whether to only check that the email address is structured correctly.
     * @returns
     */
    async validateEmail(
        email: string,
        structureOnly?: boolean
    ): Promise<boolean> {
        const result = await this.isValidEmailAddress(email, structureOnly);

        if (result.success) {
            return result.allowed;
        } else {
            // Return true so that the server can validate when we get a server error.
            return true;
        }
    }

    /**
     * Determines if the given email address is valid.
     * @param email The email address to check.
     * @param structureOnly Whether to only check that the email address is structured correctly.
     * @returns
     */
    async isValidEmailAddress(
        email: string,
        structureOnly?: boolean
    ): Promise<IsValidEmailAddressResult> {
        // Validation is handled on the server
        const indexOfAt = email.indexOf('@');
        if (indexOfAt < 0 || indexOfAt >= email.length) {
            return {
                success: true,
                allowed: false,
            };
        }

        if (structureOnly) {
            return {
                success: true,
                allowed: true,
            };
        }

        const result = await axios.post<IsValidEmailAddressResult>(
            `${this.apiEndpoint}/api/v2/email/valid`,
            {
                email,
            },
            {
                validateStatus: (status) => status < 500,
            }
        );

        return result.data;
    }

    async isValidDisplayName(
        displayName: string,
        name: string
    ): Promise<IsValidDisplayNameResult> {
        const result = await axios.post<IsValidDisplayNameResult>(
            `${this.apiEndpoint}/api/v2/displayName/valid`,
            {
                displayName,
                name,
            },
            {
                validateStatus: (status) => status < 500,
            }
        );

        return result.data;
    }

    async validateSmsNumber(sms: string): Promise<boolean> {
        // Validation is handled on the server
        return true;
    }

    isLoggedIn(): boolean {
        const sessionKey = this.savedSessionKey;
        if (!sessionKey) {
            return false;
        }
        const parsed = parseSessionKey(sessionKey);
        if (!parsed) {
            return false;
        }

        const [userId, sessionId, sessionSecret, expireTimeMs] = parsed;
        if (Date.now() >= expireTimeMs) {
            return false;
        }

        return true;
    }

    async loadUserInfo() {
        const [userId, sessionId, sessionSecret, expireTimeMs] =
            parseSessionKey(this.savedSessionKey);
        this._userId = userId;
        this._sessionId = sessionId;
        this._appMetadata = await this._loadAppMetadata();

        if (!this._appMetadata) {
            this._userId = null;
            this._sessionId = null;
            this.savedSessionKey = null;
            this.savedConnectionKey = null;
        } else {
            this._saveAcceptedTerms(true);
            if (this.email) {
                this._saveEmail(this.email);
            }
        }

        this._loginState.next(this.userInfoLoaded);
        return this.userInfoLoaded;
    }

    async createPublicRecordKey(
        recordName: string,
        policy: PublicRecordKeyPolicy
    ): Promise<CreatePublicRecordKeyResult> {
        if (!this.userInfoLoaded) {
            await this.loadUserInfo();
        }
        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/records/key`,
            {
                recordName: recordName,
                policy: policy,
            },
            {
                headers: this._authenticationHeaders(),
                validateStatus: (status) => status < 500,
            }
        );
        return response.data;
    }

    async logout(revokeSessionKey: boolean = true) {
        const sessionKey = this.savedSessionKey;
        if (sessionKey) {
            this.savedSessionKey = null;
            if (revokeSessionKey) {
                await this._revokeSessionKey(sessionKey);
            }
        }
        this.savedConnectionKey = null;
        this._userId = null;
        this._sessionId = null;
        this._appMetadata = null;
        this._saveEmail(null);
        this._loginState.next(false);
    }

    async listSessions(expireTimeMs: number = null): Promise<ListedSession[]> {
        const query = omitBy(
            {
                expireTimeMs,
            },
            (o) => typeof o === 'undefined' || o === null
        );
        const url = new URL(`${this.apiEndpoint}/api/v2/sessions`);
        for (let key in query) {
            url.searchParams.set(key, query[key].toString());
        }
        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
        });

        const result = response.data as ListSessionsResult;

        if (result.success) {
            return result.sessions;
        } else {
            return [];
        }
    }

    async listSubscriptions(): Promise<GetSubscriptionStatusSuccess> {
        const url = new URL(
            `${this.apiEndpoint}/api/${this.userId}/subscription`
        );
        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as GetSubscriptionStatusResult;

        if (result.success === true) {
            return result;
        } else {
            if (result.errorCode === 'not_supported') {
                return null;
            }
            return null;
        }
    }

    async listSubscriptionsV2(
        request: Pick<GetSubscriptionStatusRequest, 'studioId' | 'userId'>
    ): Promise<GetSubscriptionStatusSuccess> {
        const url = new URL(`${this.apiEndpoint}/api/v2/subscriptions`);

        if ('studioId' in request) {
            url.searchParams.set('studioId', request.studioId);
        }
        if ('userId' in request) {
            url.searchParams.set('userId', request.userId);
        }

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as GetSubscriptionStatusResult;

        if (result.success === true) {
            return result;
        } else {
            if (result.errorCode === 'not_supported') {
                return null;
            }
            return null;
        }
    }

    async listRecords(): Promise<ListedRecord[]> {
        const url = new URL(`${this.apiEndpoint}/api/v2/records/list`);

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as ListRecordsResult;
        if (result.success === true) {
            return result.records;
        } else {
            if (result.errorCode === 'not_supported') {
                return [];
            }
        }

        return null;
    }

    async listStudioRecords(studioId: string): Promise<ListedRecord[]> {
        const url = new URL(
            `${
                this.apiEndpoint
            }/api/v2/records/list?studioId=${encodeURIComponent(studioId)}`
        );

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as ListRecordsResult;
        if (result.success === true) {
            return result.records;
        } else {
            if (result.errorCode === 'not_supported') {
                return [];
            }
        }

        return null;
    }

    async getStudio(studioId: string): Promise<GetStudioResult> {
        const url = new URL(
            `${this.apiEndpoint}/api/v2/studios?studioId=${encodeURIComponent(
                studioId
            )}`
        );

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
        });

        return response.data as GetStudioResult;
    }

    async updateStudio(
        studio: UpdateStudioRequest['studio']
    ): Promise<UpdateStudioResult> {
        const url = new URL(`${this.apiEndpoint}/api/v2/studios`);

        const response = await axios.put(url.href, studio, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => true,
        });

        return response.data as UpdateStudioResult;
    }

    async listStudioMembers(studioId: string): Promise<ListedStudioMember[]> {
        const url = new URL(
            `${
                this.apiEndpoint
            }/api/v2/studios/members/list?studioId=${encodeURIComponent(
                studioId
            )}`
        );

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as ListStudioMembersResult;
        if (result.success === true) {
            return result.members;
        } else {
            return [];
        }
    }

    async addStudioMember(
        request: Omit<AddStudioMemberRequest, 'userId'>
    ): Promise<AddStudioMemberResult> {
        const url = new URL(`${this.apiEndpoint}/api/v2/studios/members`);

        const response = await axios.post(url.href, request, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as AddStudioMemberResult;
        return result;
    }

    async removeStudioMember(
        request: Omit<RemoveStudioMemberRequest, 'userId'>
    ): Promise<RemoveStudioMemberResult> {
        const url = new URL(`${this.apiEndpoint}/api/v2/studios/members`);

        const response = await axios.delete(url.href, {
            data: request,
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as RemoveStudioMemberResult;
        return result;
    }

    async requestComId(
        studioId: string,
        newComId: string
    ): Promise<ComIdRequestResult> {
        const url = new URL(`${this.apiEndpoint}/api/v2/studios/requestComId`);

        const response = await axios.post(
            url.href,
            {
                studioId,
                comId: newComId,
            },
            {
                headers: this._authenticationHeaders(),
                validateStatus: (status) => true,
            }
        );

        return response.data as ComIdRequestResult;
    }

    async listStudios(comId?: string): Promise<ListedStudio[]> {
        const url = new URL(`${this.apiEndpoint}/api/v2/studios/list`);

        if (comId) {
            url.searchParams.set('comId', comId);
        }

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as ListStudiosResult;
        if (result.success === true) {
            return result.studios;
        }

        return null;
    }

    async createStudio(
        displayName: string,
        ownerStudioComId?: string
    ): Promise<string> {
        const url = new URL(`${this.apiEndpoint}/api/v2/studios`);

        const response = await axios.post(
            url.href,
            {
                displayName,
                ownerStudioComId,
            },
            {
                headers: this._authenticationHeaders(),
                validateStatus: (status) => status < 500 || status === 501,
            }
        );

        const result = response.data as CreateStudioResult;
        if (result.success === true) {
            return result.studioId;
        } else {
            return null;
        }
    }

    async createRecord(
        request: Omit<CreateRecordRequest, 'userId'>
    ): Promise<CreateRecordResult> {
        const url = new URL(`${this.apiEndpoint}/api/v2/records`);

        const response = await axios.post(
            url.href,
            {
                ...request,
            },
            {
                headers: this._authenticationHeaders(),
                validateStatus: (status) => status < 500 || status === 501,
            }
        );

        return response.data as CreateRecordResult;
    }

    async listData(recordName: string, startingAddress?: string) {
        const url = new URL(`${this.apiEndpoint}/api/v2/records/data/list`);

        url.searchParams.set('recordName', recordName);
        if (startingAddress) {
            url.searchParams.set('address', startingAddress);
        }

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as ListDataResult;
        if (result.success === true) {
            return result;
        } else {
            if (result.errorCode === 'not_supported') {
                return null;
            }
        }

        return null;
    }

    async listFiles(recordName: string, startingFileName?: string) {
        const url = new URL(`${this.apiEndpoint}/api/v2/records/file/list`);

        url.searchParams.set('recordName', recordName);
        if (startingFileName) {
            url.searchParams.set('fileName', startingFileName);
        }

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as ListFilesResult;
        if (result.success === true) {
            return result;
        } else {
            if (result.errorCode === 'not_supported') {
                return null;
            }
        }

        return null;
    }

    async eraseFile(
        recordKeyOrName: string,
        fileUrl: string
    ): Promise<boolean> {
        const url = new URL(`${this.apiEndpoint}/api/v2/records/file`);

        const response = await axios.delete(url.href, {
            headers: this._authenticationHeaders(),
            data: {
                recordKey: recordKeyOrName,
                fileUrl: fileUrl,
            },
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as EraseFileResult;
        return result.success === true;
    }

    async eraseData(
        recordKeyOrName: string,
        address: string
    ): Promise<boolean> {
        const url = new URL(`${this.apiEndpoint}/api/v2/records/data`);

        const response = await axios.delete(url.href, {
            headers: this._authenticationHeaders(),
            data: {
                recordKey: recordKeyOrName,
                address: address,
            },
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as EraseDataResult;
        return result.success === true;
    }

    async listPolicies(recordName: string, startingMarker?: string) {
        const url = new URL(`${this.apiEndpoint}/api/v2/records/policy/list`);

        url.searchParams.set('recordName', recordName);
        if (startingMarker) {
            url.searchParams.set('startingMarker', startingMarker);
        }

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as ListUserPoliciesResult;
        if (result.success === true) {
            return result;
        }

        return null;
    }

    async listRoleAssignments(recordName: string, startingRole?: string) {
        const url = new URL(
            `${this.apiEndpoint}/api/v2/records/role/assignments/list`
        );

        url.searchParams.set('recordName', recordName);
        if (startingRole) {
            url.searchParams.set('startingRole', startingRole);
        }

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as ListRoleAssignmentsResult;
        if (result.success === true) {
            return result;
        } else {
            if (result.errorCode === 'not_supported') {
                return null;
            }
        }

        return null;
    }

    async listEvents(recordName: string, startingEventName?: string) {
        const url = new URL(`${this.apiEndpoint}/api/v2/records/events/list`);

        url.searchParams.set('recordName', recordName);
        if (startingEventName) {
            url.searchParams.set('eventName', startingEventName);
        }

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as ListEventsResult;
        if (result.success === true) {
            return result;
        } else {
            if (result.errorCode === 'not_supported') {
                return null;
            }
        }

        return null;
    }

    async deleteInst(recordName: string, inst: string) {
        const url = new URL(`${this.apiEndpoint}/api/v2/records/insts`);

        const response = await axios.delete(url.href, {
            headers: this._authenticationHeaders(),
            data: {
                recordName: recordName,
                inst: inst,
            },
            validateStatus: (status) => status < 500 || status === 501,
        });

        return response.data as EraseInstResult;
    }

    async listInsts(recordName: string, startingInst?: string) {
        const url = new URL(`${this.apiEndpoint}/api/v2/records/insts/list`);

        url.searchParams.set('recordName', recordName);
        if (startingInst) {
            url.searchParams.set('inst', startingInst);
        }

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as ListInstsResult;
        if (result.success === true) {
            return result;
        } else {
            if (result.errorCode === 'not_supported') {
                return null;
            }
        }

        return null;
    }

    async manageSubscriptions(
        options?: Pick<
            CreateManageSubscriptionRequest,
            'subscriptionId' | 'expectedPrice'
        >
    ): Promise<void> {
        const url = new URL(
            `${this.apiEndpoint}/api/${this.userId}/subscription/manage`
        );
        const response = await axios.post(url.href, !!options ? options : {}, {
            headers: this._authenticationHeaders(),
        });

        const result = response.data as CreateManageSubscriptionResult;

        if (result.success === true) {
            location.href = result.url;
        } else {
            console.error(
                '[AuthManager] Unable to manage subscriptions!',
                result
            );
        }
    }

    async manageSubscriptionsV2(
        options: Pick<
            CreateManageSubscriptionRequest,
            'subscriptionId' | 'expectedPrice' | 'userId' | 'studioId'
        >
    ): Promise<void> {
        const url = new URL(`${this.apiEndpoint}/api/v2/subscriptions/manage`);
        const response = await axios.post(url.href, options, {
            headers: this._authenticationHeaders(),
        });

        const result = response.data as CreateManageSubscriptionResult;

        if (result.success === true) {
            location.href = result.url;
        } else {
            console.error(
                '[AuthManager] Unable to manage subscriptions!',
                result
            );
        }
    }

    getComIdFromUrl(): string {
        const params = new URLSearchParams(location.search);
        if (params.has('comId') || params.has('comID')) {
            return params.get('comId') ?? params.get('comID');
        } else {
            return null;
        }
    }

    async getComIdWebConfig(comId: string): Promise<GetPlayerConfigResult> {
        const url = new URL(`${this.apiEndpoint}/api/v2/player/config`);
        url.searchParams.set('comId', comId);
        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
        });

        const result = response.data as GetPlayerConfigResult;
        return result;
    }

    private async _revokeSessionKey(sessionKey: string): Promise<void> {
        try {
            const response = await axios.post(
                `${this.apiEndpoint}/api/v2/revokeSession`,
                {
                    sessionKey: sessionKey,
                },
                {
                    headers: {
                        Authorization: `Bearer ${sessionKey}`,
                    },
                }
            );
            console.log('[AuthManager] Session key revoked!');
        } catch (err) {
            console.log('[AuthManager] Could not revoke session key:', err);
        }
    }

    async loginWithEmail(email: string) {
        return this._login(email, 'email');
    }

    async loginWithPhoneNumber(phoneNumber: string) {
        return this._login(phoneNumber, 'phone');
    }

    async loginWithPrivo() {
        const response = await axios.post<OpenIDLoginRequestResult>(
            `${this.apiEndpoint}/api/v2/login/privo`,
            {},
            {
                validateStatus: (status) => status < 500,
            }
        );

        const result = response.data;
        // if (result.success === true) {
        //     this.savedSessionKey = result.sessionKey;
        //     this.savedConnectionKey = result.connectionKey;
        //     this._userId = result.userId;
        // }

        return result;
    }

    async signUpWithPrivo(info: PrivoSignUpInfo) {
        return await this._privoRegister(info);
    }

    async processAuthCode(
        params: object
    ): Promise<ProcessOpenIDAuthorizationCodeResult> {
        const response = await axios.post<ProcessOpenIDAuthorizationCodeResult>(
            `${this.apiEndpoint}/api/v2/oauth/code`,
            {
                ...params,
            },
            {
                validateStatus: (status) => status < 500,
            }
        );

        return response.data;
    }

    async completeOAuthLogin(
        requestId: string
    ): Promise<CompleteOpenIDLoginResult> {
        const response = await axios.post<CompleteOpenIDLoginResult>(
            `${this.apiEndpoint}/api/v2/oauth/complete`,
            {
                requestId,
            },
            {
                validateStatus: (status) => status < 500,
            }
        );

        const result = response.data;

        if (result.success === true) {
            this.savedSessionKey = result.sessionKey;
            this.savedConnectionKey = result.connectionKey;
            this._userId = result.userId;
        }

        return result;
    }

    private async _privoRegister(
        info: PrivoSignUpInfo
    ): Promise<PrivoSignUpRequestResult> {
        const response = await axios.post<PrivoSignUpRequestResult>(
            `${this.apiEndpoint}/api/v2/register/privo`,
            {
                email: !!info.email ? info.email : undefined,
                displayName: info.displayName,
                name: info.name,
                dateOfBirth: info.dateOfBirth?.toJSON(),
                parentEmail: info.parentEmail || undefined,
            },
            {
                validateStatus: (status) => true,
            }
        );

        const result = response.data;

        if (result.success === true) {
            this.savedSessionKey = result.sessionKey;
            this.savedConnectionKey = result.connectionKey;
            this._userId = result.userId;
        }

        return result;
    }

    async completeLogin(
        userId: string,
        requestId: string,
        code: string
    ): Promise<CompleteLoginResult> {
        const result = await this._completeLoginRequest(
            userId,
            requestId,
            code
        );

        if (result.success === true) {
            this.savedSessionKey = result.sessionKey;
            this.savedConnectionKey = result.connectionKey;
            this._userId = result.userId;
        }

        return result;
    }

    async revokeSession(
        userId: string,
        sessionId: string
    ): Promise<RevokeSessionResult> {
        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/revokeSession`,
            {
                userId,
                sessionId,
            },
            {
                validateStatus: (status) => status < 500,
                headers: this._authenticationHeaders(),
            }
        );

        const result = response.data as RevokeSessionResult;

        if (
            result.success &&
            userId === this.userId &&
            sessionId === this.sessionId
        ) {
            this.savedSessionKey = null;
            this.savedConnectionKey = null;
            await this.logout();
        }

        return result;
    }

    async revokeAllSessions(userId?: string): Promise<RevokeAllSessionsResult> {
        if (!userId) {
            userId = this.userId;
        }

        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/revokeAllSessions`,
            {
                userId,
            },
            {
                validateStatus: (status) => status < 500,
                headers: this._authenticationHeaders(),
            }
        );

        const result = response.data as RevokeAllSessionsResult;

        if (result.success && userId === this.userId) {
            this.savedSessionKey = null;
            this.savedConnectionKey = null;
            await this.logout();
        }

        return result;
    }

    async replaceSession(): Promise<ReplaceSessionResult> {
        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/replaceSession`,
            {},
            {
                validateStatus: (status) => status < 500,
                headers: this._authenticationHeaders(),
            }
        );

        const result = response.data as ReplaceSessionResult;

        if (result.success && result.userId === this.userId) {
            this.savedSessionKey = result.sessionKey;
            this.savedConnectionKey = result.connectionKey;
        }

        return result;
    }

    private async _completeLoginRequest(
        userId: string,
        requestId: string,
        code: string
    ): Promise<CompleteLoginResult> {
        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/completeLogin`,
            {
                userId,
                requestId,
                code,
            },
            {
                validateStatus: (status) => status < 500,
            }
        );

        return response.data;
    }

    private async _login(
        address: string,
        addressType: AddressType
    ): Promise<LoginRequestResult> {
        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/login`,
            {
                address: address,
                addressType: addressType,
            },
            {
                validateStatus: (status) => status < 500,
            }
        );

        return response.data;
    }

    get version(): string {
        return this._gitTag;
    }

    get savedEmail(): string {
        return localStorage.getItem(EMAIL_KEY);
    }

    get hasAcceptedTerms(): boolean {
        return localStorage.getItem(ACCEPTED_TERMS_KEY) === 'true';
    }

    get savedSessionKey(): string {
        return localStorage.getItem(SESSION_KEY);
    }

    set savedSessionKey(value: string) {
        if (!value) {
            localStorage.removeItem(SESSION_KEY);
        } else {
            localStorage.setItem(SESSION_KEY, value);
        }
    }

    get savedConnectionKey(): string {
        return localStorage.getItem(CONNECTION_KEY);
    }

    set savedConnectionKey(value: string) {
        if (!value) {
            localStorage.removeItem(CONNECTION_KEY);
        } else {
            localStorage.setItem(CONNECTION_KEY, value);
        }
    }

    async changeEmail(newEmail: string) {
        // TODO: Implement
        // await this.magic.user.updateEmail({
        //     email: newEmail,
        // });
        // await this.loadUserInfo();
    }

    async updateMetadata(newMetadata: Partial<AppMetadata>) {
        // TODO: Handle errors
        await this._putAppMetadata({
            avatarUrl: this.avatarUrl,
            avatarPortraitUrl: this.avatarPortraitUrl,
            displayName: this.displayName,
            name: this.name,
            email: this.email,
            phoneNumber: this.phone,
            ...newMetadata,
        });
        await this.loadUserInfo();
    }

    private _saveEmail(email: string) {
        if (email) {
            localStorage.setItem(EMAIL_KEY, email);
        } else {
            localStorage.removeItem(EMAIL_KEY);
        }
    }

    private _saveAcceptedTerms(acceptedTerms: boolean) {
        if (acceptedTerms) {
            localStorage.setItem(ACCEPTED_TERMS_KEY, 'true');
        } else {
            localStorage.removeItem(ACCEPTED_TERMS_KEY);
        }
    }

    private async _loadAppMetadata(): Promise<AppMetadata> {
        try {
            const response = await axios.get(
                `${this.apiEndpoint}/api/${encodeURIComponent(
                    this.userId
                )}/metadata`,
                {
                    headers: this._authenticationHeaders(),
                }
            );

            return response.data;
        } catch (err) {
            if (err.response) {
                if (err.response.status === 404) {
                    return null;
                } else if (err.response.status === 403) {
                    return null;
                } else if (err.response.status === 401) {
                    return null;
                }
            }
        }
    }

    private async _putAppMetadata(
        metadata: Omit<
            AppMetadata,
            'hasActiveSubscription' | 'subscriptionTier' | 'privacyFeatures'
        >
    ): Promise<AppMetadata> {
        const response = await axios.put(
            `${this.apiEndpoint}/api/${encodeURIComponent(
                this.userId
            )}/metadata`,
            metadata,
            {
                headers: this._authenticationHeaders(),
            }
        );
        return response.data;
    }

    private _authenticationHeaders(): any {
        return {
            Authorization: `Bearer ${this.savedSessionKey}`,
        };
    }

    get apiEndpoint(): string {
        return this._apiEndpoint ?? location.origin;
    }

    get websocketEndpoint(): string {
        return this._websocketEndpoint ?? location.origin;
    }

    get websocketProtocol(): RemoteCausalRepoProtocol {
        return this._websocketProtocol ?? 'websocket';
    }
}

export type LoginEvent = LoginRequestSent | LoginRequestNotSent | LoginComplete;

export interface LoginRequestSent {
    type: 'login_request_sent';
}

export interface LoginRequestNotSent {
    type: 'login_request_not_sent';
}

export interface LoginComplete {
    type: 'login_complete';
    sessionKey: string;
}
