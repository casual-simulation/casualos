import { AuthUser } from './AuthStore';
import {
    SuccessResult,
    DateMS,
    GenericTimeKeys,
    GigQty,
    ISO4217_Map,
    CurrencySFU,
} from './TypeUtils';

export type XpStore = {
    /**
     * Save an xp user with an associated account
     * @param user The user to create
     * @param account The account to create
     */
    saveXpUserWithAccount: (
        user: XpUser,
        account: XpAccount
    ) => Promise<void>;

    /**
     * Get an xp account by its id
     * @param accountId The id of the account to get
     */
    getXpAccount: (accountId: XpAccount['id']) => Promise<XpAccount>;

    /**
     * Get an xp account entry by its id
     * @param entryId The id of the entry to get
     */
    getXpAccountEntry: (
        entryId: XpAccountEntry['id']
    ) => Promise<XpAccountEntry>;

    /**
     * Get an xp contract by its id
     * @param contractId The id of the contract to get
     */
    getXpContract: (contractId: XpContract['id']) => Promise<XpContract>;

    /**
     * Get an xp invoice by its id
     * @param invoiceId The id of the invoice to get
     */
    getXpInvoice: (invoiceId: XpInvoice['id']) => Promise<XpInvoice>;

    /**
     * Get an xp user by their auth id
     * @param id The auth user id of the user to get
     */
    getXpUserByAuthId: (id: AuthUser['id']) => Promise<XpUser>;

    /**
     * Get an xp user by their xp id
     * @param id The xp user id of the xp user to get
     */
    getXpUserById: (id: XpUser['id']) => Promise<XpUser>;

    /**
     * Save an xp account for a user or contract
     * @param associationId The id of the xp user or contract to create an account for
     * @param account The account to save
     */
    saveXpAccount<T extends 'user' | 'contract' = 'user'>(
        associationId: T extends 'user' ? XpUser['id'] : XpContract['id'],
        account: XpAccount
    ): Promise<SuccessResult>;

    /**
     * Save an xp contract with an associated account
     * @param contract The contract to save
     * @param account The account to save
     */
    saveXpContract: (
        contract: XpContract,
        account: XpAccount | null
    ) => Promise<void>;

    /**
     * Save an xp user associated with the given auth user
     * @param id The id of the xp user to create an account for (uuid) not the auth user id
     * @param user The meta data to associate with the user
     */
    saveXpUser: (id: XpUser['id'], user: XpUser) => Promise<SuccessResult>;

    /**
     * Performs a transaction consisting of multiple entries
     * @param entries The entries to perform the transaction with
     */
    // inTransaction: () => Promise<void>; // TODO: Implement this
};

/**
 * An extensible model for all models in the xp system
 */
export interface ModelBase extends GenericTimeKeys {
    /** The unique id of the model item  */
    id: string;
}

/**
 * Data to be returned within get invocation results on each model
 */
export interface XpUser extends ModelBase {
    /** The id of the associated account */
    accountId: XpAccount['id'];
    /** The rate at which the user is requesting payment (null if not yet specified) */
    requestedRate: CurrencySFU | null;
    /** The users unique id from the Auth system */
    userId: string;
}

/**
 * An account in the xp system
 * * Ties the— and enables tracking of— the flow of money between entities
 * * Hosts entries that represent the addition or withdrawal of money
 */
export interface XpAccount extends ModelBase {
    /** The time at which (if) the account was closed */
    closedTimeMs: DateMS | null;
    /** The currency of the account */
    currency: keyof ISO4217_Map;
}

/**
 * Mimics a "Smart Contract" (crypto/blockchain) data model for the xp system
 */
export interface XpContract extends ModelBase {
    /** The id of the account associated with the contract */
    accountId: XpAccount['id'];
    /** A description of the contract, may contain useful query meta */
    description: string | null;
    /** The id of the user holding the contract */
    holdingUserId: XpUser['id'] | null;
    /** The id of the user issuing the contract */
    issuerUserId: XpUser['id'];
    /** The rate at which the entirety of the contract is worth */
    rate: CurrencySFU;
    /** An amount of money associated with a contract offer (would be the amount in the contract account if accepted) */
    offeredWorth: CurrencySFU;
    /** The status of the contract */
    status: 'open' | 'draft' | 'closed';
}

/**
 * Represents an entry in an xp account
 * * Used to track the flow of money in the xp system (ledger)
 */
export interface XpAccountEntry extends ModelBase {
    /** The id of the account associated with the account entry */
    accountId: XpAccount['id'];
    /** The amount of money to be contributed to the account, negative for withdrawals */
    amount: number;
    /** The new balance of the account after the entry was made */
    balance: number;
    /** A note for the entry */
    note: string | null;
    /** The id of the system event associated with the account entry */
    systemEventId: XpSystemEvent['id'];
    /** The time at which the entry was made in the real world */
    timeMs: DateMS;
    /** An id of a transaction, used to group entries together */
    transactionId: string;
}

/**
 * Represents an adjustment event in the xp system (audit tool)
 */
export interface XpSystemEventAdjustment extends ModelBase {}

/**
 * Represents an event in the xp system (audit tool)
 */
export interface XpSystemEvent extends ModelBase {
    /** The XpSystemEventAdjustment id of the adjusting adjustment event */
    adjustingEventId: XpSystemEventAdjustment['id'] | null;
    /** The XpSystemEventAdjustment id of the adjusted adjustment event */
    adjusterEventId: XpSystemEventAdjustment['id'] | null;
    /** JSON data related to the event, which can be of any return type */
    data: any;
    /** The time the event occurred in the real world */
    timeMs: DateMS;
    /** The string literal representation of a type of system event */
    type:
        | 'adjustment'
        | 'create_invoice'
        | 'create_contract'
        | 'create_account_entry';
    /** The id of the user who performed the event (null if system caused) */
    xpUserId: XpUser['id'] | null;
}

/**
 * Represents an invoice for a contract
 */
export interface XpInvoice extends ModelBase {
    /** The id of the contract the invoice is made for */
    contractId: XpContract['id'];
    /** The quantity of gigs being invoiced for */
    amount: GigQty;
    /** The status of the invoice */
    status: 'open' | 'paid' | 'void';
    /** The reason (if any) the invoice was made void */
    voidReason: 'rejected' | 'cancelled' | null;
    /** An id of a transaction associated with the invoice(s) */
    transactionId: string;
    /** A note for the invoice */
    note: string | null;
}
