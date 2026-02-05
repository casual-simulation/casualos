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
    MultiError,
    Result,
    ServerError,
    SimpleError,
    Success,
} from '@casual-simulation/aux-common';
import { AccountBalance, isSuccess } from '@casual-simulation/aux-common';
import {
    failure,
    isFailure,
    logErrors,
    logError,
    success,
    unwrap,
} from '@casual-simulation/aux-common';
import type {
    InterfaceTransferError,
    TransferCodes,
} from './FinancialInterface';
import {
    ACCOUNT_IDS,
    AccountCodes,
    AMOUNT_MAX,
    CREDITS_DISPLAY_FACTOR,
    CURRENCIES,
    getAccountCurrency,
    getFlagsForAccountCode,
    getFlagsForTransferCode,
    getMessageForAccountError,
    LEDGERS,
    processAccountErrors,
    processTransferErrors,
    USD_DISPLAY_FACTOR,
    type FinancialInterface,
} from './FinancialInterface';
import type { Account, CreateTransferError, Transfer } from 'tigerbeetle-node';
import {
    AccountFilterFlags,
    AccountFlags,
    CreateAccountError,
    TransferFlags,
} from 'tigerbeetle-node';
import { traced } from '../tracing/TracingDecorators';
import type {
    FinancialAccount,
    FinancialAccountFilter,
    FinancialStore,
    UniqueFinancialAccountFilter,
} from './FinancialStore';

const TRACE_NAME = 'FinancialController';

export class FinancialController {
    private _financialInterface: FinancialInterface;
    private _idempotentKeyMaxAgeMS = 3600000; // 1 hour
    private _financialStore: FinancialStore;

    constructor(
        financialInterface: FinancialInterface,
        financialStore: FinancialStore
    ) {
        this._financialInterface = financialInterface;
        this._financialStore = financialStore;
    }

    @traced(TRACE_NAME)
    async init(): Promise<Result<void, SimpleError>> {
        // Ensure that the financial interface has the correct accounts
        const results = await this._financialInterface.createAccounts([
            {
                id: ACCOUNT_IDS.assets_cash,
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
            {
                id: ACCOUNT_IDS.assets_stripe,
                code: AccountCodes.assets_stripe,
                flags: getFlagsForAccountCode(AccountCodes.assets_stripe),
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
            {
                id: ACCOUNT_IDS.revenue_xp_platform_fees,
                code: AccountCodes.revenue_platform_fees,
                flags: getFlagsForAccountCode(
                    AccountCodes.revenue_platform_fees
                ),
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
            {
                id: ACCOUNT_IDS.revenue_store_platform_fees,
                code: AccountCodes.revenue_platform_fees,
                flags: getFlagsForAccountCode(
                    AccountCodes.revenue_platform_fees
                ),
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
            {
                id: ACCOUNT_IDS.revenue_records_usage_usd,
                code: AccountCodes.revenue_platform_fees,
                flags: getFlagsForAccountCode(
                    AccountCodes.revenue_platform_fees
                ),
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
            {
                id: ACCOUNT_IDS.revenue_records_usage_credits,
                code: AccountCodes.revenue_platform_fees,
                flags: getFlagsForAccountCode(
                    AccountCodes.revenue_platform_fees
                ),
                credits_pending: 0n,
                credits_posted: 0n,
                debits_pending: 0n,
                debits_posted: 0n,
                user_data_128: 0n,
                user_data_64: 0n,
                user_data_32: 0,
                timestamp: 0n,
                ledger: LEDGERS.credits,
                reserved: 0,
            },
            {
                id: ACCOUNT_IDS.liquidity_usd,
                code: AccountCodes.liquidity_pool,
                flags:
                    getFlagsForAccountCode(AccountCodes.liquidity_pool) |
                    AccountFlags.debits_must_not_exceed_credits,
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
            {
                id: ACCOUNT_IDS.liquidity_credits,
                code: AccountCodes.liquidity_pool,
                flags:
                    getFlagsForAccountCode(AccountCodes.liquidity_pool) |
                    AccountFlags.credits_must_not_exceed_debits,
                credits_pending: 0n,
                credits_posted: 0n,
                debits_pending: 0n,
                debits_posted: 0n,
                user_data_128: 0n,
                user_data_64: 0n,
                user_data_32: 0,
                timestamp: 0n,
                ledger: LEDGERS.credits,
                reserved: 0,
            },

            {
                id: ACCOUNT_IDS.USD_SETUP,
                code: AccountCodes.control,
                flags: AccountFlags.none,
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
            {
                id: ACCOUNT_IDS.USD_LIMIT_CREDITS,
                code: AccountCodes.control,
                flags: AccountFlags.credits_must_not_exceed_debits,
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
            {
                id: ACCOUNT_IDS.USD_LIMIT_DEBITS,
                code: AccountCodes.control,
                flags: AccountFlags.debits_must_not_exceed_credits,
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
            {
                id: ACCOUNT_IDS.CREDITS_SETUP,
                code: AccountCodes.control,
                flags: AccountFlags.none,
                credits_pending: 0n,
                credits_posted: 0n,
                debits_pending: 0n,
                debits_posted: 0n,
                user_data_128: 0n,
                user_data_64: 0n,
                user_data_32: 0,
                timestamp: 0n,
                ledger: LEDGERS.credits,
                reserved: 0,
            },
            {
                id: ACCOUNT_IDS.CREDITS_LIMIT_CREDITS,
                code: AccountCodes.control,
                flags: AccountFlags.credits_must_not_exceed_debits,
                credits_pending: 0n,
                credits_posted: 0n,
                debits_pending: 0n,
                debits_posted: 0n,
                user_data_128: 0n,
                user_data_64: 0n,
                user_data_32: 0,
                timestamp: 0n,
                ledger: LEDGERS.credits,
                reserved: 0,
            },
            {
                id: ACCOUNT_IDS.CREDITS_LIMIT_DEBITS,
                code: AccountCodes.control,
                flags: AccountFlags.debits_must_not_exceed_credits,
                credits_pending: 0n,
                credits_posted: 0n,
                debits_pending: 0n,
                debits_posted: 0n,
                user_data_128: 0n,
                user_data_64: 0n,
                user_data_32: 0,
                timestamp: 0n,
                ledger: LEDGERS.credits,
                reserved: 0,
            },
        ]);

        let failed = false;
        for (let result of results) {
            if (result.result !== CreateAccountError.ok) {
                console.error(
                    `[FinancialController] Failed to create default accounts (${result.index},${result.result})`,
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

    generateId() {
        return this._financialInterface.generateId();
    }

    /**
     * Creates a new account with the given code.
     * For internal use only.
     * @param code The code for the new account.
     * @param ledger The ledger for the new account.
     */
    @traced(TRACE_NAME)
    async createAccount(
        code: AccountCodes,
        ledger: (typeof LEDGERS)[keyof typeof LEDGERS]
    ): Promise<CreateFinancialAccountResult> {
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
            ledger: ledger,
            reserved: 0,
        });

        const accountErrors = processAccountErrors(results);

        if (isFailure(accountErrors)) {
            logErrors(
                accountErrors.error,
                '[FinancialController] [createAccount]'
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: 'Failed to create account.',
            });
        }

        return success({
            id: id.toString(),
        });
    }

    /**
     * Gets the account with the given ID.
     * @param accountId The ID of the account to get.
     * @returns
     */
    @traced(TRACE_NAME)
    async getAccount(
        accountId: bigint | string
    ): Promise<Result<Account, SimpleError>> {
        if (typeof accountId === 'string') {
            accountId = BigInt(accountId);
        }
        const [account] = await this._financialInterface.lookupAccounts([
            accountId,
        ]);

        if (!account) {
            return failure({
                errorCode: 'not_found',
                errorMessage: `The account with ID '${accountId}' does not exist.`,
            });
        }

        return success(account);
    }

    @traced(TRACE_NAME)
    async getTransfer(
        transferId: bigint | string
    ): Promise<Result<Transfer, SimpleError>> {
        if (typeof transferId === 'string') {
            transferId = BigInt(transferId);
        }

        const transfers = await this._financialInterface.lookupTransfers([
            transferId,
        ]);

        if (transfers.length === 0) {
            return failure({
                errorCode: 'not_found',
                errorMessage: `The transfer with ID '${transferId}' does not exist.`,
            });
        }

        return success(transfers[0]);
    }

    /**
     * Gets the details for the financial account with the given ID.
     * @param accountId The ID of the account to get details for.
     */
    @traced(TRACE_NAME)
    async getAccountDetails(
        accountId: bigint | string
    ): Promise<GetFinancialAccountResult> {
        const financialAccount = await this._financialStore.getAccountById(
            accountId.toString()
        );

        if (!financialAccount) {
            return failure({
                errorCode: 'not_found',
                errorMessage: `The financial account does not exist.`,
            });
        }

        const account = await this.getAccount(financialAccount.id);

        if (isFailure(account)) {
            return account;
        }

        return success({
            account: account.value,
            financialAccount,
        });
    }

    /**
     * Attempts to get the financial account for the given filter.
     * @param filter The filter to use.
     */
    @traced(TRACE_NAME)
    async getFinancialAccount(
        filter: UniqueFinancialAccountFilter
    ): Promise<GetFinancialAccountResult> {
        const financialAccount = await this._financialStore.getAccountByFilter(
            filter
        );

        if (!financialAccount) {
            return failure({
                errorCode: 'not_found',
                errorMessage: `The financial account does not exist.`,
            });
        }

        const account = await this.getAccount(financialAccount.id);

        if (isFailure(account)) {
            return account;
        }

        return success({
            account: account.value,
            financialAccount,
        });
    }

    /**
     * Gets or creates a financial account for the given filter.
     * @param filter The filter to use.
     */
    @traced(TRACE_NAME)
    async getOrCreateFinancialAccount(
        filter: UniqueFinancialAccountFilter
    ): Promise<GetFinancialAccountResult> {
        let account = await this._financialStore.getAccountByFilter(filter);

        let accountResult: Result<Account, SimpleError>;
        if (!account) {
            console.log(
                `[FinancialController] [getOrCreateFinancialAccount] Creating account for filter [userId: ${filter.userId}, studioId: ${filter.studioId}, contractId: ${filter.contractId}] on ledger ${filter.ledger}`
            );

            let result: CreateFinancialAccountResult;
            if (filter.userId) {
                result = await this.createAccount(
                    AccountCodes.liabilities_user,
                    filter.ledger
                );
            } else if (filter.studioId) {
                result = await this.createAccount(
                    AccountCodes.liabilities_studio,
                    filter.ledger
                );
            } else if (filter.contractId) {
                result = await this.createAccount(
                    AccountCodes.liabilities_contract,
                    filter.ledger
                );
            }

            if (isFailure(result)) {
                return result;
            }

            account = {
                id: result.value.id.toString(),
                userId: filter.userId,
                studioId: filter.studioId,
                contractId: filter.contractId,
                ledger: filter.ledger,
                currency: CURRENCIES.get(filter.ledger),
            };
            await this._financialStore.createAccount(account);

            accountResult = await this.getAccount(result.value.id);
        } else {
            accountResult = await this.getAccount(account.id);
        }

        if (isFailure(accountResult)) {
            return accountResult;
        }

        return success({
            account: accountResult.value,
            financialAccount: account,
        });
    }

    /**
     * Gets the list of accounts for the given filter.
     * @param filter The filter to use.
     */
    @traced(TRACE_NAME)
    async listAccounts(
        filter: FinancialAccountFilter
    ): Promise<GetAccountsResult> {
        const accounts = await this._financialStore.listAccounts(filter);
        const results = await Promise.all(
            accounts.map((account) => this.getAccount(account.id))
        );

        const errors = results.filter((result) => isFailure(result));

        if (errors.length > 0) {
            return failure({
                errorCode: 'multi_error',
                errorMessage: 'Some accounts could not be retrieved.',
                errors: errors.map((e) => e.error),
            });
        }

        return success({
            accounts: results.map((r) => unwrap(r)),
        });
    }

    /**
     * Gets the account balances for the given account filter.
     * @param filter The filter to use.
     */
    @traced(TRACE_NAME)
    async getAccountBalances(
        filter: Omit<UniqueFinancialAccountFilter, 'ledger'>
    ): Promise<Result<AccountBalances | undefined, SimpleError>> {
        const [usdResult, creditsResult] = await Promise.all([
            this.getAccountBalance({
                ...filter,
                ledger: LEDGERS.usd,
            }),
            this.getAccountBalance({
                ...filter,
                ledger: LEDGERS.credits,
            }),
        ]);

        if (isFailure(usdResult)) {
            return usdResult;
        } else if (isFailure(creditsResult)) {
            return creditsResult;
        }

        if (!usdResult.value && !creditsResult.value) {
            return success(undefined);
        }

        return success({
            usd: usdResult.value,
            credits: creditsResult.value,
        });
    }

    /**
     * Gets the balance for the account matching the given filter.
     * @param filter The filter to use.
     */
    @traced(TRACE_NAME)
    async getAccountBalance(
        filter: UniqueFinancialAccountFilter
    ): Promise<Result<AccountBalance | undefined, SimpleError>> {
        const result = await this.getFinancialAccount(filter);
        if (isFailure(result)) {
            if (result.error.errorCode === 'not_found') {
                return success(undefined);
            } else {
                return result;
            }
        }

        return success(this.convertToAccountBalance(result.value.account));
    }

    /**
     * Converts the given account data to an account balance.
     * @param account The account to convert.
     */
    convertToAccountBalance(account: Account): AccountBalance {
        return new AccountBalance({
            accountId: account.id.toString(),
            credits: account.credits_posted,
            debits: account.debits_posted,
            pendingCredits: account.credits_pending,
            pendingDebits: account.debits_pending,
            currency: getAccountCurrency(account),
            displayFactor:
                account.ledger === LEDGERS.credits
                    ? CREDITS_DISPLAY_FACTOR
                    : USD_DISPLAY_FACTOR,
        });
    }

    /**
     * Transfers funds between two internal accounts.
     * Suitable for moving money between user accounts and contracts.
     * Not suitable for interfacing with external systems such as Stripe.
     *
     * Not for public use.
     * @param request The request for the transfer.
     */
    @traced(TRACE_NAME)
    async internalTransaction(
        request: InternalTransferRequest
    ): Promise<TransferResult> {
        let transfers: Transfer[] = [];
        const transactionId =
            typeof request.transactionId === 'string'
                ? BigInt(request.transactionId)
                : typeof request.transactionId === 'bigint'
                ? request.transactionId
                : this._financialInterface.generateId();

        for (let i = 0; i < request.transfers.length; i++) {
            const transfer = request.transfers[i];
            const transferId =
                typeof transfer.transferId === 'string'
                    ? BigInt(transfer.transferId)
                    : typeof transfer.transferId === 'bigint'
                    ? transfer.transferId
                    : this._financialInterface.generateId();

            const currency = transfer.currency.toLowerCase();
            const ledger = (LEDGERS as Record<string, number>)[currency];

            if (typeof ledger !== 'number') {
                return failure({
                    errorCode: 'unsupported_currency',
                    errorMessage: `The currency '${currency}' is not supported.`,
                    errors: [],
                });
            }

            let flags = getFlagsForTransferCode(transfer.code);
            let timeout = 0;

            if (i < request.transfers.length - 1) {
                flags |= TransferFlags.linked;
            }

            if ('pending' in transfer && transfer.pending) {
                flags |= TransferFlags.pending;

                if (transfer.timeoutSeconds <= 0) {
                    return failure({
                        errorCode: 'invalid_transfer',
                        errorMessage:
                            'Pending transfers must have a positive timeoutSeconds value.',
                        errors: [],
                    });
                }

                timeout = transfer.timeoutSeconds;
            }

            if (transfer.balancingCredit) {
                flags |= TransferFlags.balancing_credit;
            }

            if (transfer.balancingDebit) {
                flags |= TransferFlags.balancing_debit;
            }

            if (transfer.closingCredit) {
                flags |= TransferFlags.closing_credit | TransferFlags.pending;
            }

            if (transfer.closingDebit) {
                flags |= TransferFlags.closing_debit | TransferFlags.pending;
            }

            transfers.push({
                id: transferId,
                amount:
                    typeof transfer.amount === 'number'
                        ? BigInt(transfer.amount)
                        : transfer.amount,
                code: transfer.code,
                credit_account_id: BigInt(transfer.creditAccountId),
                debit_account_id: BigInt(transfer.debitAccountId),
                flags: flags,
                ledger: ledger,
                pending_id: 0n,
                timeout: 0,
                timestamp: 0n,
                user_data_128: transactionId,
                user_data_64: 0n,
                user_data_32: 0,
            });
        }

        const results = await this._financialInterface.createTransfers(
            transfers
        );

        const transferResult = processTransferErrors(results, transfers);

        return this._processTransferResult(
            transactionId,
            transfers,
            transferResult
        );
    }

    @traced(TRACE_NAME)
    async completePendingTransfers(
        request: PostTransfersRequest
    ): Promise<TransferResult> {
        let transfers: Transfer[] = [];
        const transactionId =
            typeof request.transactionId === 'string'
                ? BigInt(request.transactionId)
                : typeof request.transactionId === 'bigint'
                ? request.transactionId
                : this._financialInterface.generateId();

        for (let i = 0; i < request.transfers.length; i++) {
            const id = request.transfers[i];
            const transferId = typeof id === 'string' ? BigInt(id) : id;

            let flags = request.flags ?? TransferFlags.post_pending_transfer;
            const amount = BigInt(request.amount ?? AMOUNT_MAX);

            if (i < request.transfers.length - 1) {
                flags |= TransferFlags.linked;
            }

            transfers.push({
                id: this._financialInterface.generateId(),
                amount:
                    (flags & TransferFlags.void_pending_transfer) ===
                    TransferFlags.void_pending_transfer
                        ? 0n
                        : amount,
                code: 0,
                credit_account_id: 0n,
                debit_account_id: 0n,
                pending_id: transferId,
                flags,
                ledger: 0,
                timeout: 0,
                timestamp: 0n,
                user_data_128: transactionId,
                user_data_64: 0n,
                user_data_32: 0,
            });
        }

        const results = await this._financialInterface.createTransfers(
            transfers
        );

        const transferResult = processTransferErrors(results, transfers);

        return this._processTransferResult(
            transactionId,
            transfers,
            transferResult
        );
    }

    @traced(TRACE_NAME)
    async listTransfers(
        accountId: bigint | string
    ): Promise<Result<Transfer[], SimpleError>> {
        if (typeof accountId === 'string') {
            accountId = BigInt(accountId);
        }

        const transfers = await this._financialInterface.getAccountTransfers({
            account_id: accountId,
            code: 0, // 0 means all codes
            flags: AccountFilterFlags.credits | AccountFilterFlags.debits,
            limit: 1000, // Limit to 1000 transfers
            timestamp_max: 0n, // No timestamp limit
            timestamp_min: 0n, // No timestamp limit
            user_data_128: 0n, // No user data filter
            user_data_64: 0n, // No user data filter
            user_data_32: 0, // No user data filter
        });

        return success(transfers);
    }

    @traced(TRACE_NAME)
    async queryTransfers(
        query: TransfersQuery
    ): Promise<Result<Transfer[], SimpleError>> {
        const transfers = await this._financialInterface.queryTransfers({
            user_data_128: BigInt(query.transactionId ?? 0n),
            code: query.code ?? 0,
            flags: 0,
            ledger: 0,
            limit: 1000,
            timestamp_max: 0n,
            timestamp_min: 0n,
            user_data_64: 0n,
            user_data_32: 0,
        });

        return success(transfers);
    }

    /**
     * Attempts to bill the given user or studio for records usage.
     * This is an async generator that yields control points where actions should be performed.
     * The caller should send back Result<{ initialCost, cost }> after each yield, and the generator will bill for that cost.
     *
     * If given an initialCost, then it will create a pending transfer for that amount.
     * If given a cost, it will complete the pending transfer (if any) and create a new transfer for the remaining amount (if any), or refund the difference (if cost is less than initialCost).
     * If given a failed result, then it will void any pending transfer.
     *
     * @param params The billing parameters (without the action callback).
     * @returns An async generator that yields for each action and returns all collected data.
     *
     * @example
     * const billing = controller.billForUsage({ userId, studioId, transferCode });
     *
     * // Setup a pending transfer.
     * const initial = await billing.next(success({ initialCost: 200 }));
     *
     * // Check if initial was successful
     *
     * // Perform the first action.
     * const action1Result = await performAction1();
     *
     * // Bill for the cost of the first action
     * const result = await billing.next(success({ cost: 100 }));
     *
     * // Perform the second action.
     * const action2Result = await performAction2();
     *
     * // Bill for cost of the second action
     * const final = await billing.next(success({ cost: 50 }));
     *
     */
    @traced(TRACE_NAME)
    async billForUsage(
        params: UsageBillingOptions
    ): Promise<
        AsyncGenerator<
            Success<void>,
            Result<void, SimpleError>,
            Result<BillingStep, SimpleError>
        >
    > {
        const gen = this._billForUsage(params);
        await gen.next();
        return gen;
    }

    @traced(TRACE_NAME)
    async *_billForUsage(
        params: UsageBillingOptions
    ): AsyncGenerator<
        Success<void>,
        Result<void, SimpleError>,
        Result<BillingStep, SimpleError>
    > {
        let accountResult: GetFinancialAccountResult | null = null;
        const maxSteps = params.maxSteps || 100;

        // Get or create the user's credits account
        accountResult = await this.getOrCreateFinancialAccount({
            userId: params.userId,
            studioId: params.studioId,
            ledger: LEDGERS.credits,
        });

        if (isFailure(accountResult)) {
            logError(
                accountResult.error,
                `[FinancialController] [userId: ${params.userId} studioId: ${params.studioId}] Failed to get or create financial account for filter`
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: 'The server encountered an error.',
            });
        }

        let initialAmount: bigint = 0n;
        let initialTransferResult: TransferResult;
        const transactionId = this._financialInterface.generateId();

        console.log(
            `[FinancialController] [userId: ${params.userId} studioId: ${params.studioId} transactionId: ${transactionId}] Billing usage for account ID ${accountResult.value.account.id}`
        );

        // Process each action and bill for it
        try {
            for (let steps = 0; steps < maxSteps; steps++) {
                const result = yield success();

                if (isFailure(result)) {
                    if (
                        initialTransferResult &&
                        isSuccess(initialTransferResult)
                    ) {
                        console.log(
                            `[FinancialController] [userId: ${params.userId} studioId: ${params.studioId} transactionId: ${transactionId}] Voiding billing transfer for account ${accountResult.value.account.id} due to action failure.`
                        );

                        // cancel the transfer
                        const cancelResult =
                            await this.completePendingTransfers({
                                transfers:
                                    initialTransferResult.value.transferIds,
                                transactionId: transactionId,
                                flags: TransferFlags.void_pending_transfer,
                            });

                        if (isFailure(cancelResult)) {
                            logError(
                                cancelResult.error,
                                `[FinancialController] Failed to cancel billing transfer for user ${params.userId} after action failure.`
                            );
                        }
                    }

                    return result;
                }

                const { cost } = result.value;

                if (cost) {
                    const costBigInt = BigInt(cost);
                    const additionalAmount = costBigInt - initialAmount;
                    const hadInitialTransfer =
                        initialTransferResult &&
                        isSuccess(initialTransferResult);

                    console.log(
                        `[FinancialController] [userId: ${params.userId} studioId: ${params.studioId} transactionId: ${transactionId}] Billing for cost of ${cost} credits for account ${accountResult.value.account.id}.\nCurrently pending: ${initialAmount}\nAdditional amount: ${additionalAmount}\n`
                    );

                    if (
                        initialTransferResult &&
                        isSuccess(initialTransferResult)
                    ) {
                        const completeResult =
                            await this.completePendingTransfers({
                                transfers:
                                    initialTransferResult.value.transferIds,
                                transactionId: transactionId,
                                amount:
                                    costBigInt < initialAmount
                                        ? costBigInt
                                        : initialAmount,
                            });

                        if (isFailure(completeResult)) {
                            logError(
                                completeResult.error,
                                `[FinancialController] Failed to complete billing transfer for user ${params.userId}.`
                            );

                            const cancelResult =
                                await this.completePendingTransfers({
                                    transfers:
                                        initialTransferResult.value.transferIds,
                                    transactionId: transactionId,
                                    flags: TransferFlags.void_pending_transfer,
                                });

                            if (isFailure(cancelResult)) {
                                logError(
                                    cancelResult.error,
                                    `[FinancialController] Failed to cancel billing transfer for user ${params.userId} after action failure.`
                                );
                            }

                            return failure({
                                errorCode: 'server_error',
                                errorMessage:
                                    'The server encountered an error.',
                            });
                        }

                        initialTransferResult = null;
                    }

                    if (additionalAmount > 0) {
                        const balancingDebit = hadInitialTransfer;
                        if (balancingDebit) {
                            console.log(
                                '[FinancialController] Applying balancing debit for additional billing transfer.'
                            );
                        }

                        const additionalTransferResult =
                            await this.internalTransaction({
                                transactionId: transactionId,
                                transfers: [
                                    {
                                        debitAccountId:
                                            accountResult.value.account.id,
                                        creditAccountId:
                                            ACCOUNT_IDS.revenue_records_usage_credits,
                                        amount: additionalAmount,
                                        currency: 'credits',
                                        code: params.transferCode,
                                        balancingDebit: balancingDebit,
                                    },
                                ],
                            });

                        if (isFailure(additionalTransferResult)) {
                            if (
                                additionalTransferResult.error.errorCode ===
                                    'debits_exceed_credits' &&
                                additionalTransferResult.error.accountId ===
                                    accountResult.value.account.id.toString()
                            ) {
                                logError(
                                    additionalTransferResult.error,
                                    `[FinancialController] [userId: ${params.userId} studioId: ${params.studioId} transactionId: ${transactionId}] User has insufficient funds for additional billing transfer of ${additionalAmount} credits.`,
                                    console.warn
                                );

                                // User doesn't have enough money
                                return failure({
                                    errorCode: 'insufficient_funds',
                                    errorMessage:
                                        'Insufficient funds to cover usage.',
                                });
                            }

                            logError(
                                additionalTransferResult.error,
                                `[FinancialController] [userId: ${params.userId} studioId: ${params.studioId} transactionId: ${transactionId}] Additional billing transfer failed`
                            );

                            return failure({
                                errorCode: 'server_error',
                                errorMessage:
                                    'The server encountered an error.',
                            });
                        }
                    }
                }

                if (result.value.initialCost) {
                    if (initialTransferResult) {
                        console.error(
                            `[FinancialController] Initial transfer already exists!`
                        );
                        return failure({
                            errorCode: 'server_error',
                            errorMessage: 'The server encountered an error.',
                        });
                    }

                    console.log(
                        `[FinancialController] [userId: ${params.userId} studioId: ${params.studioId} transactionId: ${transactionId}] Creating initial pending transfer for ${result.value.initialCost} credits for account ${accountResult.value.account.id}.`
                    );

                    const newInitialTransferResult =
                        await this.internalTransaction({
                            transactionId,
                            transfers: [
                                {
                                    debitAccountId:
                                        accountResult.value.account.id,
                                    creditAccountId:
                                        ACCOUNT_IDS.revenue_records_usage_credits,
                                    amount: result.value.initialCost,
                                    currency: 'credits',
                                    code: params.transferCode,
                                    pending: true,
                                    timeoutSeconds: 300,
                                },
                            ],
                        });

                    if (isFailure(newInitialTransferResult)) {
                        if (
                            newInitialTransferResult.error.errorCode ===
                                'debits_exceed_credits' &&
                            newInitialTransferResult.error.accountId ===
                                accountResult.value.account.id.toString()
                        ) {
                            logError(
                                newInitialTransferResult.error,
                                `[FinancialController] [userId: ${params.userId} studioId: ${params.studioId} transactionId: ${transactionId}] User has insufficient funds for initial billing transfer of ${result.value.initialCost} credits.`,
                                console.warn
                            );

                            // User doesn't have enough money
                            return failure({
                                errorCode: 'insufficient_funds',
                                errorMessage:
                                    'Insufficient funds to cover usage.',
                            });
                        }

                        logError(
                            newInitialTransferResult.error,
                            `[FinancialController] Initial billing transfer failed`
                        );
                        return failure({
                            errorCode: 'server_error',
                            errorMessage: 'The server encountered an error.',
                        });
                    }

                    initialAmount = BigInt(result.value.initialCost);
                    initialTransferResult = newInitialTransferResult;
                }
            }

            return success();
        } catch (e) {
            // Generator completed normally
            return success();
        }
    }

    private _processTransferResult(
        transactionId: bigint,
        transfers: Transfer[],
        transferResult: Result<void, MultiError<InterfaceTransferError>>
    ): TransferResult {
        if (isFailure(transferResult)) {
            // logErrors(
            //     transferResult.error,
            //     `[XpController] [transfer transactionId: ${transactionId}]`
            // );

            const errors = transferResult.error.errors.map(
                ({ transfer, ...e }) => e
            );

            const exceedsDebits = transferResult.error.errors.find(
                (e) => e.errorCode === 'exceeds_debits'
            );
            if (exceedsDebits) {
                return failure({
                    errorCode: 'credits_exceed_debits',
                    errorMessage:
                        'The transfer would cause the account credits to exceed its debits.',
                    accountId:
                        exceedsDebits.transfer.credit_account_id.toString(),
                    errors: errors,
                });
            }
            const exceedsCredits = transferResult.error.errors.find(
                (e) => e.errorCode === 'exceeds_credits'
            );
            if (exceedsCredits) {
                return failure({
                    errorCode: 'debits_exceed_credits',
                    errorMessage:
                        'The transfer would cause the account debits to exceed its credits.',
                    accountId:
                        exceedsCredits.transfer.debit_account_id.toString(),
                    errors: errors,
                });
            }

            const exists = transferResult.error.errors.find(
                (e) => e.errorCode === 'exists'
            );
            if (exists) {
                return failure({
                    errorCode: 'transfer_already_exists',
                    errorMessage: `The transfer (${exists.transfer.id}) already exists.`,
                    errors: errors,
                });
            }

            const completed = transferResult.error.errors.find(
                (e) =>
                    e.errorCode === 'already_posted' ||
                    e.errorCode === 'already_voided'
            );
            if (completed) {
                return failure({
                    errorCode: 'transfer_already_completed',
                    errorMessage: `The transfer (${completed.transfer.pending_id}) has already been posted/voided.`,
                    errors: errors,
                });
            }

            return failure({
                errorCode: 'server_error',
                errorMessage: 'An error occurred while transferring the funds.',
                errors: errors,
            });
        }

        return success({
            transactionId: transactionId.toString(),
            transferIds: transfers.map((t) => t.id.toString()),
        });
    }

    // /**
    //  * Filters errors in the list returning all errors that are not ok
    //  * @param errors The list of create transfer errors to filter
    //  */
    // private _filterOkCreateTransfersError(
    //     errors: CreateTransfersError[]
    // ): GenuineCreateTransfersError[] {
    //     const filteredErrors: GenuineCreateTransfersError[] = [];
    //     for (const error of errors) {
    //         if (error.result !== CreateTransferError.ok) {
    //             filteredErrors.push(error);
    //         }
    //     }
    //     return filteredErrors;
    // }

    // /**
    //  * Check if the idempotency key is valid (as it is typically provided by the client)
    //  * @param idempotencyKey The idempotency key to validate.
    //  */
    // private _validateIdempotencyKey(
    //     idempotencyKey: bigint
    // ): SuccessResult | FailedResult {
    //     //? Max idempotencyKey >= 2n ** 128n - 2n (reserve - 1n for tigerbeetle)
    //     if (
    //         idempotencyKey === null ||
    //         idempotencyKey <= 0n ||
    //         idempotencyKey >= 340282366920938463463374607431768211455n
    //     ) {
    //         return {
    //             success: false,
    //             errorCode: 'invalid_request',
    //             errorMessage:
    //                 'Idempotency key must be a positive integer which is less than 2^128 - 1',
    //         };
    //     }

    //     /**
    //      * ? In the future we may enforce tigerbeetle's recommended 128-bit idempotency key?
    //      * * See https://docs.tigerbeetle.com/coding/data-modeling/#tigerbeetle-time-based-identifiers-recommended
    //      */

    //     return {
    //         success: true,
    //     };
    // }

    // /**
    //  * Generate an account (user or contract) configured for the given currency
    //  * * Will link all accounts in their creation to provide atomicity
    //  * @param accountConf The configuration for the account
    //  */
    // public async generateAccounts(accounts: GenAccountConfig[]): Promise<{
    //     ids: Account['id'][][];
    //     /**
    //      * Any genuine errors that occurred during account generation
    //      * * The financial interface will return ok as an error if the account was created successfully
    //      * * This implementation aims to remove the default ok error from the list as it is not a genuine error
    //      */
    //     errors: CreateAccountsError[];
    // }> {
    //     const _accounts: Account[] = [];
    //     const idArray = accounts.map((account) => {
    //         const subIdArray = [];
    //         const flags = (account.flags ?? 0) | AccountFlags.linked;
    //         for (let i = 0; i < account.quantity; i++) {
    //             const id = this._financialInterface.generateId();
    //             _accounts.push({
    //                 id,
    //                 debits_pending: 0n,
    //                 debits_posted: 0n,
    //                 credits_pending: 0n,
    //                 credits_posted: 0n,
    //                 user_data_128: 0n,
    //                 user_data_64: 0n,
    //                 user_data_32: 0,
    //                 reserved: 0,
    //                 ledger: 1,
    //                 code: account.accountCode,
    //                 flags: flags,
    //                 timestamp: 0n,
    //             });
    //             subIdArray.push(id);
    //         }
    //         return subIdArray;
    //     });
    //     _accounts[_accounts.length - 1].flags &= ~AccountFlags.linked;
    //     const interfaceErrors = await this._financialInterface.createAccounts(
    //         _accounts
    //     );
    //     const errors = [];
    //     for (let i = 0; i < interfaceErrors.length; i++) {
    //         if (interfaceErrors[i].result !== CreateAccountError.ok) {
    //             errors.push(interfaceErrors[i]);
    //         }
    //     }
    //     return {
    //         ids: idArray,
    //         errors,
    //     };
    // }

    // /**
    //  * Niche account generation process
    //  * * Useful for generating accounts (multiple of any type) in a batch where some may fail.
    //  * @param config The configuration for the accounts to generate
    //  * @returns The ids of the accounts generated or the result of the onFail callback
    //  */
    // public async nicheAccountGen(config: {
    //     /** The configuration for each type of account to generate (quantity inclusive) */
    //     accounts: GenAccountConfig[];
    //     /** The callback to run if errors occur in account generation */
    //     onFail: (errors: CreateAccountsError[]) => any;
    // }) {
    //     const { ids, errors } = await this.generateAccounts(config.accounts);
    //     if (errors.length) {
    //         return config.onFail(errors);
    //     }
    //     return ids;
    // }

    // /**
    //  * Gets the account with the given id
    //  * @param accountId The id of the account to get
    //  */
    // public async getAccount(accountId: Account['id']): Promise<Account> {
    //     return (await this._financialInterface.lookupAccounts([accountId]))[0];
    // }

    // public async createIdempotentTransfer(
    //     transfer: {
    //         debit: Account['id'];
    //         credit: Account['id'];
    //         amount: bigint;
    //         code: TransferCodes;
    //     },
    //     idempotencyKey: bigint
    // ): Promise<
    //     | SuccessResult
    //     | ActionResult_T<
    //           false,
    //           { createTransfersErrors: GenuineCreateTransfersError[] }
    //       >
    //     | FailedResult
    // > {
    //     const idempotencyKeyResult =
    //         this._validateIdempotencyKey(idempotencyKey);
    //     if (idempotencyKeyResult.success === false) {
    //         return idempotencyKeyResult;
    //     }
    //     const createTransfersErrors = this._filterOkCreateTransfersError(
    //         await this._financialInterface.createTransfers([
    //             {
    //                 id: idempotencyKey,
    //                 debit_account_id: transfer.debit,
    //                 credit_account_id: transfer.credit,
    //                 amount: transfer.amount,
    //                 pending_id: 0n,
    //                 user_data_128: 0n,
    //                 user_data_64: 0n,
    //                 user_data_32: 0,
    //                 timeout: 0,
    //                 ledger: 1,
    //                 code: transfer.code,
    //                 timestamp: 0n,
    //                 flags: 0,
    //             },
    //         ])
    //     );

    //     if (createTransfersErrors.length === 0) {
    //         return {
    //             success: true,
    //         };
    //     }

    //     return {
    //         success: false,
    //         createTransfersErrors,
    //     };
    // }
}

/**
 * Gets the balance of the given account.
 *
 * For asset accounts, the balance is calculated as: debits_posted - credits_posted.
 * For liability accounts, the balance is calculated as: credits_posted - debits_posted.
 * For revenue accounts, the balance is calculated as: credits_posted - debits_posted.
 *
 * @param account The account to get the balance of.
 * @returns
 */
export function getAccountBalance(account: Account): number {
    switch (account.code) {
        case AccountCodes.assets_cash:
            return getAssetAccountBalance(account);
        case AccountCodes.liabilities_user:
        case AccountCodes.liabilities_contract:
        case AccountCodes.revenue_platform_fees:
            return getLiabilityAccountBalance(account);
        case AccountCodes.liquidity_pool:
            return getLiquidityPoolBalance(account);
        // Add other cases for different account codes as needed
        default:
            throw new Error(`Unsupported account code: ${account.code}`);
    }
}

/**
 * Gets the balance of the given liability account.
 * For liability accounts, the balance is calculated as: credits_posted - debits_posted.
 * @param account The account to get the balance of.
 */
export function getLiabilityAccountBalance(account: Account): number {
    return Number(
        account.credits_posted -
            account.debits_posted -
            (account.credits_pending - account.debits_pending)
    );
}

/**
 * Gets the balance of the given asset account.
 * For asset accounts, the balance is calculated as: debits_posted - credits_posted.
 * @param account The account to get the balance of.
 */
export function getAssetAccountBalance(account: Account): number {
    return Number(
        account.debits_posted -
            account.credits_posted -
            (account.debits_pending - account.credits_pending)
    );
}

/**
 * Gets the balance of the given liquidity pool account.
 * For liquidity accounts, the balance is calculated as: debits_posted - credits_posted.
 * @param account The account to get the balance of.
 */
export function getLiquidityPoolBalance(account: Account): number {
    return Number(
        account.debits_posted -
            account.credits_posted -
            (account.debits_pending - account.credits_pending)
    );
}

interface GenAccountConfig {
    /**
     * The code associated with the type of account(s) to generate.
     */
    accountCode: AccountCodes;
    /**
     * The number of accounts of this configuration to generate.
     * * Useful when creating user and contract accounts in one go.
     */
    quantity: number;
    /**
     * The flags to set on the account(s).
     * * Defaults to 0.
     */
    flags?: number;
}

type AccountType = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';

/**
 * Errors that are both nominally and logically errors
 * * * These errors are those which aren't false assertions / paradoxical (like ok as an error)
 */
type GenuineCreateTransferError = Omit<
    CreateTransferError,
    CreateTransferError.ok
>;
type GenuineCreateTransfersError = {
    index: number;
    result: GenuineCreateTransferError;
};

export type CreateFinancialAccountResult = Result<
    {
        /**
         * The ID of the account that was created.
         */
        id: string;
    },
    SimpleError
>;

export interface AccountWithDetails {
    account: Account;
    financialAccount: FinancialAccount;
}

export type GetFinancialAccountResult = Result<AccountWithDetails, SimpleError>;

export type GetAccountsResult = Result<
    {
        accounts: Account[];
    },
    MultiError<SimpleError>
>;

export type TransferError = {
    errorCode:
        | ServerError
        | 'debits_exceed_credits'
        | 'credits_exceed_debits'
        | 'invalid_transfer'
        | 'unsupported_currency'
        | 'transfer_already_exists'
        | 'transfer_already_completed';

    errorMessage: string;

    /**
     * The ID of the account that had the issue.
     */
    accountId?: string;

    /**
     * The errors that occurred during the transfer.
     */
    errors: Omit<InterfaceTransferError, 'transfer'>[];
};

export type InternalTransfer = PendingTransfer | NonPendingTransfer;

export interface InternalTransferBase {
    /**
     * The ID of the transfer that should be created.
     * If null, then a new transfer will be created.
     */
    transferId?: bigint | string | null;

    /**
     * The ID of the account that is being debited.
     */
    debitAccountId: bigint | string;

    /**
     * The ID of the account that is being credited.
     */
    creditAccountId: bigint | string;

    /**
     * The amount of the transfer.
     */
    amount: bigint | number;

    /**
     * The currency of the transfer.
     */
    currency: string;

    /**
     * The code of the transfer.
     */
    code: TransferCodes;

    /**
     * Whether the transfer is a balancing credit or not.
     *
     * Balancing credits are used to transfer at most amount — automatically transferring less than amount as necessary such that `credit_account.credits_pending + credit_account.credits_posted ≤ credit_account.debits_posted`.
     *
     * Defaults to false.
     */
    balancingCredit?: boolean;

    /**
     * Whether the transfer is a balancing debit or not.
     *
     * Transfer at most amount — automatically transferring less than amount as necessary such that `debit_account.debits_pending + debit_account.debits_posted ≤ debit_account.credits_posted`.
     *
     * Defaults to false.
     */
    balancingDebit?: boolean;

    /**
     * Wether to mark the debit account as closed after this transfer is processed.
     * If set, then the transfer will automatically be marked as pending.
     */
    closingDebit?: boolean;

    /**
     * Wether to mark the credit account as closed after this transfer is processed.
     * If set, then the transfer will automatically be marked as pending.
     */
    closingCredit?: boolean;
}

export interface NonPendingTransfer extends InternalTransferBase {
    /**
     * Non-pending transfers cannot have a pending state.
     */
    pending?: never;
    timeoutSeconds?: never;
}

/**
 * A transfer that is pending completion.
 */
export interface PendingTransfer extends InternalTransferBase {
    /**
     * Wether the transfer is pending or not.
     */
    pending: true;

    /**
     * The number of seconds before the pending transfer times out.
     *
     * All pending transfers must have a timeout.
     */
    timeoutSeconds: number;
}

export interface InternalTransferRequest {
    /**
     * The transfers that should be performed in a transcation.
     */
    transfers: InternalTransfer[];

    /**
     * The ID of the transaction that should be created.
     * If null, then a new transaction will be created.
     */
    transactionId?: bigint | string | null;

    // TODO: support idempotency
    // /**
    //  * The idempotency key that should be used.
    //  * If specified, then the transaction ID and transfer IDs will be generated from this key.
    //  * If not specifed, then one will be generated.
    //  * Must be a UUID.
    //  */
    // idempotencyKey?: string | null;
}

export interface PostTransfersRequest {
    /**
     * The transfers that should be performed in a transcation.
     */
    transfers: (string | bigint)[];

    /**
     * The ID of the transaction that should be created.
     */
    transactionId?: bigint | string | null;

    /**
     * The flags to set on the transfers.
     * If not specified, then post_pending_transfer will be set.
     */
    flags?: TransferFlags;

    /**
     * The amount to post/void for each transfer.
     */
    amount?: bigint | number;
}

export type TransferResult = Result<
    {
        /**
         * The IDs of the transfers that were created.
         */
        transferIds: string[];

        /**
         * The ID of the transaction that was created.
         */
        transactionId: string;
    },
    TransferError
>;

export interface TransfersQuery {
    /**
     * The ID of the transaction to query transfers for.
     */
    transactionId?: bigint | string;

    /**
     * The code to fitler transfers by.
     */
    code?: TransferCodes;
}

/**
 * Represents the balances of a user/studio/contract's financial accounts.
 */
export interface AccountBalances {
    /**
     * The USD account balance.
     *
     * This will be undefined if the user does not have a USD account.
     */
    usd: AccountBalance | undefined;

    /**
     * The credits account balance.
     *
     * This will be undefined if the user does not have a credits account.
     */
    credits: AccountBalance | undefined;
}

export interface UsageBillingOptions {
    /**
     * The ID of the user to bill.
     * Cannot be specified with studioId.
     */
    userId?: string;

    /**
     * The ID of the studio to bill.
     * Cannot be specified with userId.
     */
    studioId?: string;

    // /**
    //  * The initial amount that should be reserved before performing the action.
    //  * If null, then no billing will be performed, but results will still be collected.
    //  */
    // initialAmount: number | null;

    /**
     * The transfer code that should be used for the billing transfer.
     */
    transferCode: TransferCodes;

    /**
     * The maximum number of billing steps that can be performed.
     *
     * Defaults to 100.
     */
    maxSteps?: number;
}

export interface BillingStep {
    /**
     * The initial cost that should be pre-authorized.
     * If specified, then a pending transfer for this amount will be created.
     */
    initialCost?: number | bigint | null;

    /**
     * If set, completes the pending transfer (if any) and attempts to bill for the remaining amount.
     */
    cost?: number | bigint | null;
}

/**
 * Attempts to bill the given user or studio for records usage.
 * This is an async generator that yields control points where actions should be performed.
 * The caller should send back Result<{ initialCost, cost }> after each yield, and the generator will bill for that cost.
 *
 * If given an initialCost, then it will create a pending transfer for that amount.
 * If given a cost, it will complete the pending transfer (if any) and create a new transfer for the remaining amount (if any), or refund the difference (if cost is less than initialCost).
 * If given a failed result, then it will void any pending transfer.
 *
 * @param financial The financial controller to use for billing. If null, then no billing will be performed and each step will simply yield success.
 * @param params The billing parameters (without the action callback).
 * @returns An async generator that yields for each action and returns all collected data.
 *
 * @example
 * const billing = controller.billForUsage({ userId, studioId, transferCode });
 *
 * // Setup a pending transfer.
 * const initial = await billing.next(success({ initialCost: 200 }));
 *
 * // Check if initial was successful
 *
 * // Perform the first action.
 * const action1Result = await performAction1();
 *
 * // Bill for the cost of the first action
 * const result = await billing.next(success({ cost: 100 }));
 *
 * // Perform the second action.
 * const action2Result = await performAction2();
 *
 * // Bill for cost of the second action
 * const final = await billing.next(success({ cost: 50 }));
 *
 */
export async function billForUsage(
    financial: FinancialController | null,
    params: UsageBillingOptions
): Promise<
    AsyncGenerator<
        Success<void>,
        Result<void, SimpleError>,
        Result<BillingStep, SimpleError>
    >
> {
    if (!financial) {
        async function* gen(): AsyncGenerator<
            Success<void>,
            Result<void, SimpleError>,
            Result<BillingStep, SimpleError>
        > {
            try {
                const maxSteps = params.maxSteps || 100;
                for (let i = 0; i < maxSteps; i++) {
                    const r = yield success();
                    if (isFailure(r)) {
                        return r;
                    }
                }

                return success();
            } catch (err) {
                return success();
            }
        }

        const generator = gen();
        return generator;
    }

    return await financial.billForUsage(params);
}
