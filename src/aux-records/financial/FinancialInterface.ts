import type {
    Account,
    AccountBalance,
    AccountFilter,
    CreateAccountsError,
    CreateTransfersError,
    QueryFilter,
    Transfer,
} from './Types';

/**
 * Standards for account codes from the systems perspective.
 * * [1000] assets
 * * [2000] liabilities
 * * [2100] liabilities to customers
 * * [3000] equity
 * * [4000] revenue
 * * [4100] revenue from sales
 * * [4200] revenue from fees
 * * [5000] expenses
 */
export enum AccountCodes {
    assets = 1000,
    liabilities = 2000,
    equity = 3000,
    revenue = 4000,
    expenses = 5000,
    assets_cash = 1001, // flags.credits_must_not_exceed_debits
    liabilities_customer = 2101, // flags.debits_must_not_exceed_credits
    liabilities_escrow = 2102, // flags.debits_must_not_exceed_credits
    revenue_platform_fees = 4201, // flags.debits_must_not_exceed_credits
}

/**
 * Standards for transfer codes from the systems perspective.
 * * [1000] <1000's class> Crediting the user (1000 is from the system if ever needed)
 * * [1100] <100's subclass> Crediting the user from external entities (e.g. deposit to system via stripe / balance reload)
 * * [1200] <200's subclass> Contract crediting
 * * [2000] <2000's class> Debiting the user (2000 is from the system if ever needed)
 * * [2100] <100's subclass> Debiting the user from external entities (e.g. withdrawal from system via stripe / payout)
 * * [2200] <200's subclass> Contract debiting
 *
 * ? The spacing levels future-proof the system for more codes.
 * ? Additional codes in this MLNC could be flags for nominally similar (to existing) multi-phase transactions.
 *
 */
export enum TransferCodes {
    /** A credit to the user from the system */
    system_credits_user = 1000,
    /** A credit to the user from external entities (e.g. deposit to system via stripe / balance reload) */
    external_credits_user = 1100,
    /** A credit to a contract from a user */
    user_credits_contract = 1200,
    /** A debit to the user from the system */
    system_debits_user = 2000,
    /** A debit to a user from external entities (e.g. withdrawal from system via stripe / payout) */
    external_debits_user = 2100,
    /** A debit to a contract from a user */
    user_debits_contract = 2200,
}

/**
 * Interface follows Client practices in "tigerbeetle-node" as a base for account and transfer operations.
 * Revise as needed if more operations are needed.
 */
export interface FinancialInterface {
    generateId: () => Account['id'];
    createAccount: (account: Account) => Promise<CreateAccountsError[]>;
    createAccounts: (batch: Account[]) => Promise<CreateAccountsError[]>;
    createTransfers: (batch: Transfer[]) => Promise<CreateTransfersError[]>;
    lookupAccounts: (batch: Account['id'][]) => Promise<Account[]>;
    lookupTransfers: (batch: Transfer['id'][]) => Promise<Transfer[]>;
    getAccountTransfers: (filter: AccountFilter) => Promise<Transfer[]>;
    getAccountBalances: (filter: AccountFilter) => Promise<AccountBalance[]>;
    queryAccounts: (filter: QueryFilter) => Promise<Account[]>;
    queryTransfers: (filter: QueryFilter) => Promise<Transfer[]>;
}
