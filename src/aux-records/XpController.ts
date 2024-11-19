import { XpAccount, XpContract, XpInvoice, XpStore, XpUser } from './XpStore';
import { AuthController } from './AuthController';
import { AuthStore, AuthUser } from './AuthStore';
import { v4 as uuid } from 'uuid';
import { ISO4217_Map, SuccessResult } from './TypeUtils';
import { KnownErrorCodes } from '@casual-simulation/aux-common';
import { traced } from './tracing/TracingDecorators';
import { iSO4217_AlphaArray, tryScope } from './Utils';

interface XpConfig {
    xpStore: XpStore;
    authController: AuthController;
    authStore: AuthStore;
}

const TRACE_NAME = 'XpController';

/**
 * Defines a class that controls an auth users relationship with the XP "system".
 */
export class XpController {
    private _auth: AuthController;
    private _authStore: AuthStore;
    private _xpStore: XpStore;

    constructor(config: XpConfig) {
        this._auth = config.authController;
        this._authStore = config.authStore;
        this._xpStore = config.xpStore;
    }

    /**
     * Generate an account (user or contract) configured for the given currency
     * @param currency The currency to configure the account for (default: USD)
     */
    private _generateAccount(currency: keyof ISO4217_Map = 'USD'): XpAccount {
        return {
            id: uuid(),
            currency,
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
            closedTimeMs: null,
        };
    }

    /**
     * Create an XP user for the given auth user
     * @param authUserId The ID of the auth user to create an XP user for
     */
    @traced(TRACE_NAME)
    private async _createXpUser(
        authUserId: string
    ): Promise<CreateXpUserResult> {
        return await tryScope(
            async () => {
                const authUser = await this._authStore.findUser(authUserId);
                if (!authUser) {
                    return {
                        success: false,
                        errorCode: 'user_not_found',
                        errorMessage: 'The user was not found.',
                    };
                }

                const xpId = uuid();
                const account: XpAccount = this._generateAccount();
                const user: XpUser = {
                    id: xpId,
                    userId: authUserId,
                    accountId: account.id,
                    requestedRate: null,
                    createdAtMs: Date.now(),
                    updatedAtMs: Date.now(),
                };
                await this._xpStore.createXpUserWithAccount(user, account);
                return { success: true, user };
            },
            {
                scope: [TRACE_NAME, this._createXpUser.name],
                errMsg: 'An error occurred while creating the user or associated account.',
                returnOnError: {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage:
                        'An error occurred while creating the user or associated account.',
                },
            }
        );
    }

    /**
     * Get an Xp user's meta data (Xp meta associated with an auth user)
     * Creates an Xp user for the auth user if one does not exist
     */
    async getXpUser(id: GetXpUserById): Promise<GetXpUserResult> {
        return await tryScope(
            async () => {
                let user =
                    (await this._xpStore[
                        `getXpUserBy${id.userId ? 'Auth' : ''}Id`
                    ](id.userId ?? id.xpId)) ?? null;
                if (id.userId !== undefined && id.xpId !== undefined)
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'Cannot use multiple identifiers to get a user.',
                    };
                if (!user && id.userId) {
                    const result = await this._createXpUser(id.userId);
                    if (result.success) {
                        user = result.user;
                    } else return result;
                }
                return user
                    ? { success: true, user }
                    : {
                          success: false,
                          errorCode: 'user_not_found',
                          errorMessage: 'The user was not found.',
                      };
            },
            {
                scope: [TRACE_NAME, this.getXpUser.name],
                errMsg: 'An error occurred while getting the user.',
                returnOnError: {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'An error occurred while getting the user.',
                },
            }
        );
    }
}
export interface GetXpUserById {
    /** The auth Id of the xp user to get (mutually exclusive with xpId) */
    userId?: AuthUser['id'];
    /** The xp Id of the xp user to get (mutually exclusive with userId) */
    xpId?: XpUser['id'];
}

export type FailedResult = SuccessResult<
    false,
    { errorCode: KnownErrorCodes; errorMessage: string }
>;

export type CreateXpUserResultSuccess = SuccessResult<true, { user: XpUser }>;
export type CreateXpUserResultFailure = FailedResult;
export type CreateXpUserResult =
    | CreateXpUserResultSuccess
    | CreateXpUserResultFailure;

export type GetXpUserResultSuccess = SuccessResult<true, { user: XpUser }>;
export type GetXpUserResultFailure = FailedResult;
export type GetXpUserResult = GetXpUserResultSuccess | GetXpUserResultFailure;

export type CreateContractResultSuccess = SuccessResult<
    true,
    {
        contract: XpContract;
        account: XpAccount;
    }
>;
export type CreateContractResultFailure = FailedResult;
export type CreateContractResult =
    | CreateContractResultSuccess
    | CreateContractResultFailure;

export type GetContractResultSuccess = SuccessResult<
    true,
    { contract: XpContract }
>;
export type GetContractResultFailure = FailedResult;
export type GetContractResult =
    | GetContractResultSuccess
    | GetContractResultFailure;
