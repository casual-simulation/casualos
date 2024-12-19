import { XpContract, XpInvoice, XpStore, XpUser } from './XpStore';
import { AuthController } from './AuthController';
import { AuthStore, AuthUser } from './AuthStore';
import { v4 as uuid } from 'uuid';
import {
    ISO4217_Map,
    ReduceKeysToPrimitives,
    SuccessResult,
    UnionOfTValues,
} from './TypeUtils';
import { KnownErrorCodes } from '@casual-simulation/aux-common';
import { traced } from './tracing/TracingDecorators';
import { tryScope } from './Utils';
import { Account } from './financial/Types';
import {
    AccountCodes,
    FinancialInterface,
} from './financial/FinancialInterface';

interface XpConfig {
    xpStore: XpStore;
    authController: AuthController;
    authStore: AuthStore;
    financialInterface: FinancialInterface;
}

interface GenAccountConfig {
    /**
     * The code associated with the type of account to generate.
     */
    accountCode: AccountCodes;
    /**
     * The number of accounts to generate.
     * * Useful when creating user and contract accounts in one go.
     */
    quantity: number;
}

const TRACE_NAME = 'XpController';
/** Until we target ES2020, we can't use BigInt literals, the alias is an effective alternative */
const _b = BigInt;

/**
 * Defines a class that controls an auth users relationship with the XP "system".
 */
export class XpController {
    private _auth: AuthController;
    private _authStore: AuthStore;
    private _xpStore: XpStore;
    private _fInterface: FinancialInterface;

    constructor(config: XpConfig) {
        this._auth = config.authController;
        this._authStore = config.authStore;
        this._xpStore = config.xpStore;
        this._fInterface = config.financialInterface;
    }

    /**
     * Generate an account (user or contract) configured for the given currency
     * @param accountConf The configuration for the account
     */
    private _generateAccounts(accounts: GenAccountConfig[]): Account['id'][][] {
        const _accounts: Account[] = [];
        const idArray = accounts.map((account) => {
            const subIdArray = [];
            for (let i = 0; i < account.quantity; i++) {
                const id = this._fInterface.generateId();
                _accounts.push({
                    id,
                    debits_pending: _b(0),
                    debits_posted: _b(0),
                    credits_pending: _b(0),
                    credits_posted: _b(0),
                    user_data_128: _b(0),
                    user_data_64: _b(0),
                    user_data_32: 0,
                    reserved: 0,
                    ledger: 1,
                    code: account.accountCode,
                    flags: 0,
                    timestamp: _b(0),
                });
                subIdArray.push(id);
            }
            return subIdArray;
        });
        this._fInterface.createAccounts(_accounts);
        return idArray;
    }

    /**
     * Simple helper to generate a user account
     * * Standardizes the account code for user accounts
     */
    private _generateUserAccount(): Account['id'] {
        return this._generateAccounts([
            {
                accountCode: AccountCodes.liabilities_customer,
                quantity: 1,
            },
        ])[0][0];
    }

    /**
     * Simple helper to generate a contract account
     * * Standardizes the account code for contracts
     */
    private _generateContractAccount(): Account['id'] {
        return this._generateAccounts([
            {
                accountCode: AccountCodes.liabilities_escrow,
                quantity: 1,
            },
        ])[0][0];
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

                const user: XpUser = {
                    id: uuid(),
                    userId: authUserId,
                    accountId: this._generateUserAccount(),
                    requestedRate: null,
                    createdAtMs: Date.now(),
                    updatedAtMs: Date.now(),
                };
                await this._xpStore.saveXpUser(user.id, user);
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

    /**
     * Get a contract by its id
     * @param id The id of the contract to get
     */
    async getContractById(id: XpContract['id']): Promise<GetContractResult> {
        return await tryScope(
            async () => {
                const getContractResult = await this._xpStore.getXpContract(id);
                if (!getContractResult)
                    return {
                        success: false,
                        errorCode: 'not_found',
                        errorMessage: 'The contract was not found.',
                    };
                return {
                    success: true,
                    contract: getContractResult,
                };
            },
            {
                scope: [TRACE_NAME, this.getContractById.name],
                errMsg: 'An error occurred while getting the contract.',
                returnOnError: {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage:
                        'An error occurred while getting the contract.',
                },
            }
        );
    }

    /**
     * Creates a contract between two users (issuer and holder) for the given rate
     * @param config The configuration for the contract
     */
    async createContract(config: {
        description?: XpContract['description'];
        issuerUserId: GetXpUserById;
        holdingUserId: GetXpUserById | null;
        rate: XpContract['rate'];
        offeredWorth: XpContract['offeredWorth'] | null;
        status: XpContract['status'];
        //* This is when the contract was requested to be created (received by the server)
        creationRequestReceivedAt: XpContract['createdAtMs'];
    }): Promise<CreateContractResult> {
        return await tryScope(
            async () => {
                const issuer = await this.getXpUser(config.issuerUserId);

                if (!issuer.success)
                    return {
                        success: false,
                        errorCode: 'user_not_found',
                        errorMessage: 'The issuing user was not found.',
                    };

                if (!['draft', 'open'].includes(config.status))
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'The contract status during creation must be one of literals "draft" or "open".',
                    };

                if (config.status !== 'draft' && !config.holdingUserId)
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'The contract status must be "draft" if no contract recipient is provided.',
                    };

                let holder = null;
                let accountId = null;

                if (config.status === 'open') {
                    holder = await this.getXpUser(config.holdingUserId);

                    if (!holder.success)
                        return {
                            success: false,
                            errorCode: 'user_not_found',
                            errorMessage:
                                'The holding (contract recipient) user was not found.',
                        };

                    if (issuer.user.id === holder.user.id)
                        return {
                            success: false,
                            errorCode: 'invalid_request',
                            errorMessage:
                                'The issuer and holder cannot be the same user.',
                        };

                    accountId = this._generateContractAccount();
                }

                const contract: XpContract = {
                    id: uuid(),
                    description: config.description ?? null,
                    accountId,
                    issuerUserId: issuer.user.id,
                    holdingUserId: holder ? holder.user.id : null,
                    rate: config.rate,
                    offeredWorth: config.offeredWorth,
                    status: config.status,
                    createdAtMs: Date.now(),
                    updatedAtMs: Date.now(),
                };

                await this._xpStore.saveXpContract(contract);

                return {
                    success: true,
                    contract,
                };
            },
            {
                scope: [TRACE_NAME, 'createContract'],
                errMsg: 'An error occurred while creating the contract.',
                returnOnError: {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage:
                        'An error occurred while creating the contract.',
                },
            }
        );
    }

    /**
     * Converts a draft to a complete contract issued to a user and creates an account for it
     * @param config The configuration for the issuing of the draft contract
     * @returns
     */
    async issueDraftContract(config: {
        draftContractId: XpContract['id'];
        receivingUserId: GetXpUserById;
    }) {
        return await tryScope(
            async () => {
                const draftContract = await this.getContractById(
                    config.draftContractId
                );

                if (!draftContract.success)
                    return {
                        success: false,
                        errorCode: 'not_found',
                        errorMessage: 'The draft contract was not found.',
                    };

                //* Shallow copy of the contract object to be able to modify it prior to return
                const contract = { ...draftContract.contract };

                if (contract.status !== 'draft')
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'The contract must be in draft status to issue it.',
                    };

                const receivingUser = await this.getXpUser(
                    config.receivingUserId
                );

                if (!receivingUser.success)
                    return {
                        success: false,
                        errorCode: 'user_not_found',
                        errorMessage: 'The receiving user was not found.',
                    };

                if (contract.issuerUserId === receivingUser.user.id)
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'The issuing and holding (receiving) party cannot be the same user.',
                    };

                const updated = await this._xpStore.updateXpContract(
                    contract.id,
                    {
                        status: 'open',
                        accountId: this._generateContractAccount(),
                        holdingUserId: receivingUser.user.id,
                    }
                );

                if (!updated.success)
                    //? Possibly implement error code mapping, not necessary for now
                    return {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage:
                            'An error occurred while issuing the draft contract.',
                    };

                return updated;
            },
            {
                scope: [TRACE_NAME, this.issueDraftContract.name],
                errMsg: 'An error occurred while issuing the draft contract.',
                returnOnError: {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage:
                        'An error occurred while issuing the draft contract.',
                },
            }
        );
    }

    async createInvoice(config: {
        contractId: XpContract['id'];
        amount: number;
        note: string | null;
    }): Promise<CreateInvoiceResult> {
        return await tryScope(
            async () => {
                if (config.amount <= 0)
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'The invoice amount must be greater than zero.',
                    };

                const contract = await this._xpStore.getXpContract(
                    config.contractId
                );
                if (!contract)
                    return {
                        success: false,
                        errorCode: 'not_found',
                        errorMessage: 'The contract was not found.',
                    };

                if (contract.status !== 'open')
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'The contract must be open to create an invoice.',
                    };

                const account = (
                    await this._fInterface.lookupAccounts([contract.accountId])
                )[0];
                if (!account)
                    return {
                        success: false,
                        errorCode: 'not_found',
                        errorMessage: 'The invoiceable account was not found.',
                    };

                const invoice: XpInvoice = {
                    id: uuid(),
                    contractId: contract.id,
                    amount: config.amount,
                    note: config.note,
                    status: 'open',
                    transactionId: null,
                    voidReason: null,
                    createdAtMs: Date.now(),
                    updatedAtMs: Date.now(),
                };

                await this._xpStore.saveXpInvoice(invoice);

                return { success: true, invoice };
            },
            {
                scope: [TRACE_NAME, this.createInvoice.name],
                errMsg: 'An error occurred while creating the invoice.',
                returnOnError: {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage:
                        'An error occurred while creating the invoice.',
                },
            }
        );
    }
}

export type CreateInvoiceResultSuccess = SuccessResult<
    true,
    { invoice: XpInvoice }
>;
export type CreateInvoiceResultFailure = FailedResult;
export type CreateInvoiceResult =
    | CreateInvoiceResultSuccess
    | CreateInvoiceResultFailure;

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
        contract: ReduceKeysToPrimitives<XpContract>;
    }
>;
export type CreateContractResultFailure = FailedResult;
export type CreateContractResult =
    | CreateContractResultSuccess
    | CreateContractResultFailure;

export type GetContractResultSuccess = SuccessResult<
    true,
    { contract: ReduceKeysToPrimitives<XpContract> }
>;
export type GetContractResultFailure = FailedResult;
export type GetContractResult =
    | GetContractResultSuccess
    | GetContractResultFailure;
