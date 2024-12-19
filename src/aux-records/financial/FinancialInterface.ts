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
 * 1000 level assets
 * 2000 level liabilities
 * 2100 liabilities to customers
 * 3000 level equity
 * 4000 level revenue
 * 4100 revenue from sales
 * 4200 revenue from fees
 * 5000 level expenses
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
