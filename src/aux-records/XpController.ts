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
import './BigIntPatch';
import type {
    XpContract,
    XpInvoice,
    XpStore,
    XpUser,
    XpUserWithUserInfo,
} from './XpStore';
import type { AuthController, UserInfo } from './AuthController';
import type { AuthStore } from './AuthStore';
import { v4 as uuid } from 'uuid';
import type { FailedResult, StatefulResult } from './TypeUtils';

import { traced } from './tracing/TracingDecorators';
import type { Account } from './financial/Types';
import { CreateAccountError } from './financial/Types';
import type { FinancialInterface } from './financial/FinancialInterface';
import {
    ACCOUNT_IDS,
    AccountCodes,
    CURRENCIES,
    getFlagsForAccountCode,
    getMessageForAccountError,
    LEDGERS,
} from './financial/FinancialInterface';
import type {
    Result,
    SimpleError,
    UserRole,
} from '@casual-simulation/aux-common';
import {
    failure,
    isFailure,
    isSuperUserRole,
    success,
} from '@casual-simulation/aux-common';

interface XpConfig {
    xpStore: XpStore;
    authController: AuthController;
    authStore: AuthStore;
    financialInterface: FinancialInterface;
}

interface TransferConfig {
    /** The account being debited */
    account_debit: Account['id'];
    /** The account being credited */
    account_credit: Account['id'];
    /** The amount to transfer */
    amount: bigint;
    /** The idempotency key for the transfer */
    idempotencyKey: bigint;
}

/**
 * Defines the result of validating users from the controllers private method
 */
type ValidateUsersResult = StatefulResult<boolean, { users: XpUser[] }>;

const TRACE_NAME = 'XpController';

/**
 * Defines a class that controls an auth users relationship with the XP "system".
 */
export class XpController {
    private _auth: AuthController;
    private _authStore: AuthStore;
    private _xpStore: XpStore;
    private _financialInterface: FinancialInterface;

    constructor(config: XpConfig) {
        this._auth = config.authController;
        this._authStore = config.authStore;
        this._xpStore = config.xpStore;
        this._financialInterface = config.financialInterface;
    }

    async init(): Promise<Result<void, SimpleError>> {
        // Ensure that the financial interface has the correct accounts
        const results = await this._financialInterface.createAccounts([
            {
                id: ACCOUNT_IDS.stripe_assets,
                code: AccountCodes.assets_cash,
                flags: getFlagsForAccountCode(AccountCodes.assets_cash),
                credits_pending: 0n,
                credits_posted: 0n,
                debits_pending: 0n,
                debits_posted: 0n,
                user_data_128: 0n,
                user_data_64: 0n,
                user_data_32: 0,
                timestamp: 0n,
                ledger: LEDGERS.usd,
                reserved: 0,
            },
        ]);

        let failed = false;
        for (let result of results) {
            if (result.result !== CreateAccountError.ok) {
                console.error(
                    `[XpController] Failed to create default accounts (${result.index},${result.result})`,
                    getMessageForAccountError(result.result)
                );
                failed = true;
            }
        }

        if (failed) {
            return failure({
                errorCode: 'server_error',
                errorMessage: 'Failed to create default accounts.',
            });
        } else {
            return success();
        }
    }

    private async _createAccount(
        code: AccountCodes
    ): Promise<CreateXpAccountResult> {
        const id = this._financialInterface.generateId();
        const results = await this._financialInterface.createAccount({
            id: id,
            code: code,
            flags: getFlagsForAccountCode(code),
            credits_pending: 0n,
            credits_posted: 0n,
            debits_pending: 0n,
            debits_posted: 0n,
            user_data_128: 0n,
            user_data_64: 0n,
            user_data_32: 0,
            timestamp: 0n,
            ledger: LEDGERS.usd,
            reserved: 0,
        });

        if (results.some((r) => r.result !== CreateAccountError.ok)) {
            const errors = results.filter(
                (r) => r.result !== CreateAccountError.ok
            );
            console.error(
                `[XpController] [_createAccount] Failed to create account ${code}`,
                errors
                    .map(
                        (e, i) =>
                            `${i}: ${getMessageForAccountError(e.result)} (${
                                e.result
                            })`
                    )
                    .join('\n')
            );

            return failure({
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            });
        }

        return success({
            id,
        });
    }

    /**
     * Simple helper to generate a user account
     * * Standardizes the account code for user accounts
     */
    private async _generateUserAccount(): Promise<CreateXpAccountResult> {
        return await this._createAccount(AccountCodes.liabilities_user);
    }

    /**
     * Simple helper to create a contract account
     * * Standardizes the account code for contracts
     */
    private async _createContractAccount(): Promise<CreateXpAccountResult> {
        return await this._createAccount(AccountCodes.liabilities_escrow);
    }

    /**
     * Create an XP user for the given auth user
     * @param authUserId The ID of the auth user to create an XP user for
     */
    @traced(TRACE_NAME)
    private async _createXpUser(
        authUserId: string
    ): Promise<CreateXpUserResult> {
        const authUser = await this._authStore.findUser(authUserId);
        if (!authUser) {
            return failure({
                errorCode: 'user_not_found',
                errorMessage: 'The user was not found.',
            });
        }

        const account = await this._generateUserAccount();
        if (isFailure(account)) {
            return account;
        }
        const user: XpUser = {
            xpId: uuid(),
            userId: authUserId,
            accountId: account.value.id.toString(),
            requestedRate: null,
        };

        await this._xpStore.saveXpUser(user);

        return success({
            user: {
                ...authUser,
                ...user,
            },
        });
    }

    // private async _validateUsers(config: {
    //     xpIds: XpUser['id'][];
    //     authIds: AuthUser['id'][];
    // }): Promise<ValidateUsersResult | FailedResult> {
    //     return await tryScope(
    //         async () => {
    //             const batchResult = await this.batchGetXpUsers({
    //                 xpId: config.xpIds,
    //                 authId: config.authIds,
    //             });
    //             if (!batchResult.success) {
    //                 return batchResult;
    //             }
    //             const userIds = new Set(config.xpIds);
    //             const authIds = new Set(config.authIds);
    //             const filteredUsers = batchResult.users.filter(
    //                 (user) => userIds.has(user.id) || authIds.has(user.userId)
    //             );
    //             if (filteredUsers.length === 0) {
    //                 return {
    //                     success: false,
    //                     errorCode: 'user_not_found',
    //                     errorMessage: 'No users were found.',
    //                 };
    //             }
    //             if (filteredUsers.length !== config.xpIds.length) {
    //                 return {
    //                     success: false,
    //                     errorCode: 'user_not_found',
    //                     errorMessage:
    //                         'Not all users were found. Please check the provided ids.',
    //                 };
    //             }

    //             return {
    //                 success: true,
    //                 users: filteredUsers,
    //             };
    //         },
    //         {
    //             scope: [TRACE_NAME, this._validateUsers.name],
    //             errMsg: 'An error occurred while validating the users.',
    //             returnOnError: {
    //                 success: false,
    //                 errorCode: 'server_error',
    //                 errorMessage:
    //                     'An error occurred while validating the users.',
    //             },
    //         }
    //     );
    // }

    // /**
    //  * Validates the issuance of a contract between two users
    //  * @param config The configuration for the contract issuance
    //  * TODO: Iterate implementation
    //  * @returns The result of the validation (and the users from a data store if successful)
    //  */
    // private async _validateContractIssuance(config: {
    //     receivingUserId: GetXpUserById;
    //     issuingUserId: GetXpUserById;
    // }): Promise<
    //     | StatefulResult<true, { receivingUser: XpUser; issuingUser: XpUser }>
    //     | FailedResult
    // > {
    //     const validationParams: Parameters<typeof this._validateUsers>[0] = {
    //         xpIds: [],
    //         authIds: [],
    //     };
    //     if ('xpId' in config.issuingUserId) {
    //         validationParams.xpIds.push(config.issuingUserId.xpId);
    //     } else if ('userId' in config.issuingUserId) {
    //         validationParams.authIds.push(config.issuingUserId.userId);
    //     } else
    //         return {
    //             success: false,
    //             errorCode: 'invalid_request',
    //             errorMessage: 'The issuing user must have an xpId or userId.',
    //         };
    //     if ('xpId' in config.receivingUserId) {
    //         validationParams.xpIds.push(config.receivingUserId.xpId);
    //     } else if ('userId' in config.receivingUserId) {
    //         validationParams.authIds.push(config.receivingUserId.userId);
    //     } else
    //         return {
    //             success: false,
    //             errorCode: 'invalid_request',
    //             errorMessage: 'The receiving user must have an xpId or userId.',
    //         };

    //     const batchParties = await this._validateUsers(validationParams);

    //     if (!batchParties.success)
    //         return {
    //             success: false,
    //             errorCode: 'user_not_found',
    //             errorMessage: 'Some or all users were not found.',
    //         };

    //     let receivingUser = null;
    //     let issuingUser = null;

    //     if (
    //         new Set(
    //             batchParties.users.map((user) => {
    //                 if (
    //                     ('xpId' in config.receivingUserId &&
    //                         user.id === config.receivingUserId.xpId) ||
    //                     ('userId' in config.receivingUserId &&
    //                         user.userId === config.receivingUserId.userId)
    //                 ) {
    //                     receivingUser = user;
    //                 } else if (
    //                     ('xpId' in config.issuingUserId &&
    //                         user.id === config.issuingUserId.xpId) ||
    //                     ('userId' in config.issuingUserId &&
    //                         user.userId === config.issuingUserId.userId)
    //                 ) {
    //                     issuingUser = user;
    //                 }
    //                 return user.id;
    //             })
    //         ).size !== 2
    //     )
    //         return {
    //             success: false,
    //             errorCode: 'invalid_request',
    //             errorMessage:
    //                 'The issuing and receiving party cannot be the same user.',
    //         };

    //     return { success: true, receivingUser, issuingUser };
    // }

    // /**
    //  * Performs the transfer of funds from the issuer to the contract account when the contract is issued (opened)
    //  * @param config The configuration for the transfer
    //  */
    // private async _issueContractTransfer(config: {
    //     issuerAccountId: Account['id'];
    //     contractAccountId: Account['id'];
    //     contractId: XpContract['id'];
    //     amount: bigint;
    //     idempotencyKey: bigint;
    // }): Promise<
    //     | StatefulResult<true, { contract: ReduceKeysToPrimitives<XpContract> }>
    //     | FailedResult
    // > {
    //     const transferResult =
    //         await this._financialController.createIdempotentTransfer(
    //             {
    //                 debit: config.issuerAccountId,
    //                 credit: config.contractAccountId,
    //                 amount: config.amount,
    //                 code: TransferCodes.user_credits_contract,
    //             },
    //             config.idempotencyKey
    //         );
    //     if (transferResult.success === false) {
    //         if ('createTransfersErrors' in transferResult) {
    //             return {
    //                 success: false,
    //                 errorCode: 'server_error',
    //                 errorMessage:
    //                     'An error occurred while transferring the funds.',
    //             };
    //         } else {
    //             return transferResult;
    //         }
    //     }
    //     if (transferResult.success === true) {
    //         const contract = await this._xpStore.updateXpContract(
    //             config.contractId,
    //             { status: 'open' }
    //         );
    //         if (contract !== null) {
    //             return {
    //                 success: true,
    //                 contract: contract,
    //             };
    //         } else {
    //             throw new Error(
    //                 'An error occurred while updating the contract.'
    //             );
    //         }
    //     }
    // }

    /**
     * Get an Xp user's meta data (Xp meta associated with an auth user)
     * Creates an Xp user for the auth user if one does not exist
     */
    async getXpUser(request: GetXpUserRequest): Promise<GetXpUserResult> {
        let user: XpUserWithUserInfo;
        if (request.requestedXpId) {
            user = await this._xpStore.getXpUserByXpId(request.requestedXpId);
            if (!user) {
                return failure({
                    errorCode: 'user_not_found',
                    errorMessage: 'The user with the given xpId was not found.',
                });
            }
        } else if (request.requestedUserId) {
            user = await this._xpStore.getXpUserByUserId(
                request.requestedUserId
            );
        } else {
            user = await this._xpStore.getXpUserByUserId(request.userId);
        }

        if (!user) {
            if (
                request.requestedUserId &&
                request.requestedUserId !== request.userId &&
                !isSuperUserRole(request.userRole)
            ) {
                return failure({
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this operation.',
                });
            }

            const result = await this._createXpUser(
                request.requestedUserId ?? request.userId
            );
            if (isFailure(result)) {
                return result;
            } else {
                user = result.value.user;
            }
        } else if (
            user.userId !== request.userId &&
            !isSuperUserRole(request.userRole)
        ) {
            return failure({
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to perform this operation.',
            });
        }

        const { success: _, ...info } = await this._auth.getPrivateInfoForUser(
            user
        );

        const [account] = await this._financialInterface.lookupAccounts([
            BigInt(user.accountId),
        ]);

        if (!account) {
            console.error(
                `[XpController] Failed to get account for user ${user.id} (${user.accountId})`
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: 'The server encountered an error.',
            });
        }

        const balance = account.credits_posted - account.debits_posted;

        return success({
            user: {
                ...info,
                accountBalance: Number(balance),
                accountCurrency: CURRENCIES.get(account.ledger),
                accountId: user.accountId,
                requestedRate: user.requestedRate,
            },
        });
    }

    // async batchGetXpUsers(
    //     queryOptions:
    //         | {
    //               xpId: XpUser['id'][];
    //               authId?: AuthUser['id'][];
    //           }
    //         | {
    //               authId: AuthUser['id'][];
    //               xpId?: XpUser['id'][];
    //           }
    // ): Promise<BatchGetXpUserResult> {
    //     return await tryScope(
    //         async () => {
    //             const results = await this._xpStore.batchQueryXpUsers(
    //                 queryOptions
    //             );
    //             return {
    //                 success: true,
    //                 users: results,
    //             };
    //         },
    //         {
    //             scope: [TRACE_NAME, this.batchGetXpUsers.name],
    //             errMsg: 'An error occurred while getting the users.',
    //             returnOnError: {
    //                 success: false,
    //                 errorCode: 'server_error',
    //                 errorMessage: 'An error occurred while getting the users.',
    //             },
    //         }
    //     );
    // }

    // /**
    //  * Get a contract by its id
    //  * @param id The id of the contract to get
    //  */
    // async getContractById(id: XpContract['id']): Promise<GetContractResult> {
    //     return await tryScope(
    //         async () => {
    //             const getContractResult = await this._xpStore.getXpContract(id);
    //             if (!getContractResult)
    //                 return {
    //                     success: false,
    //                     errorCode: 'not_found',
    //                     errorMessage: 'The contract was not found.',
    //                 };
    //             return {
    //                 success: true,
    //                 contract: getContractResult,
    //             };
    //         },
    //         {
    //             scope: [TRACE_NAME, this.getContractById.name],
    //             errMsg: 'An error occurred while getting the contract.',
    //             returnOnError: {
    //                 success: false,
    //                 errorCode: 'server_error',
    //                 errorMessage:
    //                     'An error occurred while getting the contract.',
    //             },
    //         }
    //     );
    // }

    // /**
    //  * Creates a contract between two users (issuer and holder) for the given rate
    //  * @param config The configuration for the contract
    //  */
    // async createContract(config: {
    //     description?: XpContract['description'];
    //     issuingUserId: GetXpUserById;
    //     receivingUserId: GetXpUserById | null;
    //     rate: XpContract['rate'];
    //     offeredWorth: XpContract['offeredWorth'] | null;
    //     status: XpContract['status'];
    //     //* This is when the contract was requested to be created (received by the server)
    //     creationRequestReceivedAt: XpContract['createdAtMs'];
    //     //* This is the idempotency key for the transfer of funds from the issuer to the contract account
    //     idempotencyKey: bigint;
    // }): Promise<CreateContractResult> {
    //     return await tryScope(
    //         async () => {
    //             if (config.status !== 'draft') {
    //                 if (config.status !== 'open')
    //                     return {
    //                         success: false,
    //                         errorCode: 'invalid_request',
    //                         errorMessage:
    //                             'The contract status during creation must be one of literals "draft" or "open".',
    //                     };
    //                 if ((config.receivingUserId ?? null) === null)
    //                     return {
    //                         success: false,
    //                         errorCode: 'invalid_request',
    //                         errorMessage:
    //                             'The contract status must be "draft" if no contract recipient is provided.',
    //                     };
    //             }

    //             let receivingUser = null;
    //             let accountId = null;

    //             const issuer = await this.getXpUser(config.issuingUserId);
    //             if (issuer.success === false) return issuer;

    //             if (config.status === 'open') {
    //                 const validation = await this._validateContractIssuance({
    //                     receivingUserId: config.receivingUserId,
    //                     issuingUserId: config.issuingUserId,
    //                 });
    //                 if (validation.success === false) return validation;
    //                 receivingUser = validation.receivingUser;
    //                 const contractResult = await this._createContractAccount();

    //                 if (contractResult.isFailure()) {
    //                     return contractResult;
    //                 }

    //                 accountId = await this._createContractAccount();
    //                 if (accountId === null)
    //                     return {
    //                         success: false,
    //                         errorCode: 'server_error',
    //                         errorMessage:
    //                             'An error occurred while creating the contract account.',
    //                     };
    //             }

    //             /**
    //              * * Create the contract in a draft state initially regardless of the requested status
    //              * * This is to ensure that the contract and its associated account are created and (if open) funds have been transferred
    //              * * before the contract is truly open
    //              */
    //             const stagedDraftContract: XpContract = {
    //                 id: uuid(),
    //                 description: config.description ?? null,
    //                 accountId: accountId === null ? null : String(accountId),
    //                 issuerUserId: issuer.user.id,
    //                 holdingUserId: receivingUser?.id ?? null,
    //                 rate: config.rate,
    //                 offeredWorth: config.offeredWorth,
    //                 status: 'draft',
    //                 createdAtMs: Date.now(),
    //                 updatedAtMs: Date.now(),
    //             };

    //             const draftContract = await this._xpStore.saveXpContract(
    //                 stagedDraftContract
    //             );

    //             if (draftContract !== null && config.status === 'open') {
    //                 return await this._issueContractTransfer({
    //                     issuerAccountId: BigInt(issuer.user.accountId),
    //                     contractAccountId: BigInt(draftContract.accountId),
    //                     contractId: draftContract.id,
    //                     amount: BigInt(config.rate),
    //                     idempotencyKey: config.idempotencyKey,
    //                 });
    //             }

    //             return {
    //                 success: true,
    //                 contract: draftContract,
    //             };
    //         },
    //         {
    //             scope: [TRACE_NAME, 'createContract'],
    //             errMsg: 'An error occurred while creating the contract.',
    //             returnOnError: {
    //                 success: false,
    //                 errorCode: 'server_error',
    //                 errorMessage:
    //                     'An error occurred while creating the contract.',
    //             },
    //         }
    //     );
    // }

    // /**
    //  * Converts a draft to a complete contract issued to a user and creates an account for it
    //  * @param config The configuration for the issuing of the draft contract
    //  * @returns
    //  */
    // async issueDraftContract(config: {
    //     draftContractId: XpContract['id'];
    //     receivingUserId: GetXpUserById;
    //     idempotencyKey: bigint;
    // }) {
    //     return await tryScope(
    //         async () => {
    //             const draftContract = await this.getContractById(
    //                 config.draftContractId
    //             );

    //             if (draftContract.success === false) return draftContract;

    //             if (draftContract.contract.status !== 'draft')
    //                 return {
    //                     success: false,
    //                     errorCode: 'invalid_request',
    //                     errorMessage:
    //                         'The contract must be in draft status to issue it.',
    //                 };

    //             const validation = await this._validateContractIssuance({
    //                 receivingUserId: config.receivingUserId,
    //                 issuingUserId: {
    //                     xpId: draftContract.contract.issuerUserId,
    //                 },
    //             });

    //             if (validation.success === false) return validation;

    //             const contractAccountId =
    //                 draftContract.contract.accountId === null
    //                     ? await this._createContractAccount()
    //                     : BigInt(draftContract.contract.accountId);

    //             const issuanceTransferResult =
    //                 await this._issueContractTransfer({
    //                     issuerAccountId: BigInt(
    //                         validation.issuingUser.accountId
    //                     ),
    //                     contractAccountId,
    //                     contractId: draftContract.contract.id,
    //                     amount: BigInt(draftContract.contract.rate),
    //                     idempotencyKey: config.idempotencyKey,
    //                 });

    //             if (issuanceTransferResult.success === false)
    //                 return issuanceTransferResult;

    //             return {
    //                 success: true,
    //                 contract: await this._xpStore.updateXpContract(
    //                     draftContract.contract.id,
    //                     {
    //                         status: 'open',
    //                         accountId: String(contractAccountId),
    //                         holdingUserId: validation.receivingUser.id,
    //                     }
    //                 ),
    //             };
    //         },
    //         {
    //             scope: [TRACE_NAME, this.issueDraftContract.name],
    //             errMsg: 'An error occurred while issuing the draft contract.',
    //             returnOnError: {
    //                 success: false,
    //                 errorCode: 'server_error',
    //                 errorMessage:
    //                     'An error occurred while issuing the draft contract.',
    //             },
    //         }
    //     );
    // }

    // async createInvoice(config: {
    //     contractId: XpContract['id'];
    //     amount: number;
    //     note: string | null;
    // }): Promise<CreateInvoiceResult> {
    //     return await tryScope(
    //         async () => {
    //             if (config.amount <= 0)
    //                 return {
    //                     success: false,
    //                     errorCode: 'invalid_request',
    //                     errorMessage:
    //                         'The invoice amount must be greater than zero.',
    //                 };

    //             const contract = await this._xpStore.getXpContract(
    //                 config.contractId
    //             );
    //             if (!contract)
    //                 return {
    //                     success: false,
    //                     errorCode: 'not_found',
    //                     errorMessage: 'The contract was not found.',
    //                 };

    //             if (contract.status !== 'open')
    //                 return {
    //                     success: false,
    //                     errorCode: 'invalid_request',
    //                     errorMessage:
    //                         'The contract must be open to create an invoice.',
    //                 };

    //             console.log('contract', contract);

    //             const invoicingUser = await this.getXpUser({
    //                 xpId: contract.holdingUserId,
    //             });

    //             if (invoicingUser.success === false) return invoicingUser;

    //             const canTransfer =
    //                 await this._financialController.liabilityCanTransfer({
    //                     currentlyLiable: BigInt(contract.accountId),
    //                     targetLiable: BigInt(invoicingUser.user.accountId),
    //                     amount: BigInt(config.amount),
    //                 });

    //             if (canTransfer.success === false) return canTransfer;

    //             const invoice: XpInvoice = {
    //                 id: uuid(),
    //                 contractId: contract.id,
    //                 amount: config.amount,
    //                 note: config.note,
    //                 status: 'open',
    //                 transactionId: null,
    //                 voidReason: null,
    //                 createdAtMs: Date.now(),
    //                 updatedAtMs: Date.now(),
    //             };

    //             await this._xpStore.saveXpInvoice(invoice);

    //             return { success: true, invoice };
    //         },
    //         {
    //             scope: [TRACE_NAME, this.createInvoice.name],
    //             errMsg: 'An error occurred while creating the invoice.',
    //             returnOnError: {
    //                 success: false,
    //                 errorCode: 'server_error',
    //                 errorMessage:
    //                     'An error occurred while creating the invoice.',
    //             },
    //         }
    //     );
    // }
}

export type CreateInvoiceResult = Result<
    {
        invoice: XpInvoice;
    },
    SimpleError
>;

export interface GetXpUserRequest {
    /**
     * The ID of the currently logged in user.
     */
    userId: string;

    /**
     * The role of the user making the request.
     */
    userRole?: UserRole;

    /**
     * The ID of the xp user to get.
     * If omitted, then the requested user will be used.
     */
    requestedXpId?: string;

    /**
     * The ID of the auth user to get.
     * If omitted, then the currently logged in user will be used.
     */
    requestedUserId?: string;
}

export type CreateXpUserResult = Result<
    {
        user: XpUserWithUserInfo;
    },
    SimpleError
>;

export interface XpApiUser extends UserInfo {
    /**
     * The balance of their account.
     */
    accountBalance: number;

    /**
     * The currency of their account.
     */
    accountCurrency: string;

    /**
     * The rate that the user is requesting.
     */
    requestedRate: number | null;
}

export type GetXpUserResultSuccess = StatefulResult<true, { user: XpUser }>;
export type GetXpUserResultFailure = FailedResult;
export type GetXpUserResult = Result<
    {
        user: XpApiUser;
    },
    SimpleError
>;

// export type BatchGetXpUserResult =
//     | StatefulResult<true, { users: XpUser[] }>
//     | FailedResult;

export type CreateContractResult = Result<
    {
        contract: XpContract;
    },
    SimpleError
>;

export type GetContractResult = Result<
    {
        contract: XpContract;
    },
    SimpleError
>;

export type CreateXpAccountResult = Result<
    {
        /**
         * The ID of the account that was created.
         */
        id: bigint;
    },
    SimpleError
>;
