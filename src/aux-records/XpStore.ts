import { AuthUser } from 'AuthStore';
import { AliasUnion, ISO4217_Map, Nullable } from 'TypeUtils';

export type XpStore = {
    /**
     * Save an Xp account for a user or contract
     * @param associationId The ID of the user or contract to create an account for
     * @param account The account to save
     */
    saveXpAccount<T extends XpAccountType>(
        associationId: string,
        account: XpAccount<T>
    ): Promise<XpAccount<T>>;
    /**
     * Save an Xp user associated with the given auth user
     * @param authUserId The ID of the user to create an account for
     * @param userMeta The meta data to associate with the user
     */
    saveXpUser: (authUserId: string, userMeta: XpUser) => Promise<XpUser>;
    /**
     * Get the meta data associated with a user in the Xp system
     * @param authUserId The ID of the user whos Xp meta to get
     * @param omit The fields to omit from the Xp user model
     */
    getXpUser: (
        authUserId: string,
        omit?: XpUserDMC | 'default'
    ) => Promise<XpUser<typeof omit> | null>;

    /**
     * Performs a transaction consisting of multiple entries
     * @param entries The entries to perform the transaction with
     */
    // inTransaction: () => Promise<void>; // TODO: Implement this
};

/** Provides an extensible interface for commonly used Date markers */
interface GenericTimeKeys {
    /** The date at which the entity was created */
    createdAt: Date;
    /** The date at which the entity was last updated */
    updatedAt: Date;
}

/**
 * Represents parts of the user in the Xp system which can be used to
 * craft an efficient, "as needed", queryable, user model
 * See {@link XpUserConfiguration} for more information
 */
type XpUserOmitEnabled = {
    /** The "AuthUser" object associated with the user */
    authUser: AuthUser;
    /** The "Xp" account associated with the user */
    account?: XpAccount<'user'>;
    /** Contracts issued by the user (acting as issuer of) */
    issuedContracts: XpContract[];
    /** Contracts held by the user (acting as recipient of) */
    heldContracts: XpContract[];
};

/**
 * Represents the configuration for the Xp user model
 *
 * ? What is DMC?
 * * An acronym for "Data Model Configuration"
 */
export type XpUserDMC = AliasUnion<keyof XpUserOmitEnabled, 'omit'>;

/**
 * Represents a user in the Xp system
 * @template C The configuration for the given user model
 *
 * ? Will default override other configurations?
 * * Yes, only use default if you want to include all fields (default behavior)
 */
export type XpUser<C extends XpUserDMC | 'default' = 'default'> = {
    /** The users unique ID from within the Xp system */
    id: string;
    /** The users unique ID from the Auth system */
    userId: string;
    /** The id of the associated account (null if not yet set up) */
    accountId?: string;
    /** The rate at which the user is requesting payment (null if not yet specified) */
    requestedRate?: number;
} & GenericTimeKeys &
    ('default' extends C
        ? XpUserOmitEnabled
        : Omit<XpUserOmitEnabled, AliasUnion<C, 'omit', '', false>>);

/**
 * Represents a contract's status in the Xp system
 * * 'open'— The contract is open; and can be interacted with
 * * 'closed'— The contract is closed; and can no longer be interacted with
 */
export type XpContractStatus = 'open' | 'closed';

/**
 * Mimics a "Smart Contract" (crypto/blockchain) data model for the Xp system
 */
export type XpContract = {
    /** The unique identifier for the contract */
    id: string;
    /** The "AuthUser" ID associated with the issuer of the contract */
    issuerUserId: string;
    /** The "AuthUser" ID associated with the recipient of the contract */
    holdingUserId: string;
    /**
     * The amount of money the contract is worth (in the currency of the tied account)
     * * Synonymous with the worth of the entire contract
     * * Rate per containing contract
     */
    rate: number;
    /** A description of the contract, may contain useful query meta */
    description?: string;
    /** The status of the contract */
    status: XpContractStatus;
    /** The ID of the "XpAccount" associated with the contract */
    accountId: string;
    /** Invoices performed on this contract */
    invoices: XpInvoice[];
} & GenericTimeKeys;

/**
 * Represents the status of an invoice in the Xp system
 * * 'open'— The invoice is open; and is awaiting payment or voiding
 * * 'paid'— The invoice has been paid; and is no longer open for payment
 * * 'void'— The invoice has been voided; and is no longer open for payment
 */
export type XpInvoiceStatus = 'open' | 'paid' | 'void';

/**
 * Represents an invoice for a contract
 */
export type XpInvoice = {
    id: string;
    contractId: string;
    amount: number;
    status: XpInvoiceStatus;
    voidReason?: 'rejected' | 'cancelled';
    transactionId: string;
    note?: string;
} & GenericTimeKeys;

/**
 * Represents the type of an Xp account
 * * 'user'— An account associated with a user
 * * 'contract'— An account associated with a contract
 */
export type XpAccountType = 'user' | 'contract';

/**
 * Represents an account in the Xp system
 * * Ties the— and enables tracking of— the flow of money between entities
 * * Hosts entries that represent the addition or withdrawal of money
 */
export type XpAccount<T extends XpAccountType = 'user'> = {
    /** Unique identifier for the account */
    id: string;
    /** The entries at which this account hosts */
    entries: XpAccountEntry[];
    /**
     * An user associated with the account
     * * Mutually exclusive with the contract field
     */
    user?: T extends 'user' ? XpUser : null;
    /**
     * A contract associated with the account
     * * Mutually exclusive with the user field
     */
    contract?: T extends 'contract' ? XpContract : null;
    currency: keyof ISO4217_Map;
    closedTime: Date;
} & GenericTimeKeys;

/**
 * Represents an entry in an Xp account
 * * Used to track the flow of money in the Xp system (ledger)
 */
export type XpAccountEntry = {
    /** Unique identifier for the entry */
    id: string;
    /** The account for which the entry was made. */
    account: XpAccount;
    /**
     * The amount of money added to the account.
     * * Positive for incoming money (deposits).
     * * Negative for outgoing money (withdrawals).
     */
    amount: number;
    /** The new balance of the account after the entry was made. */
    balance: number;
    /** The time that the entry was created. */
    time: Date;
    /**
     * A transaction ID that groups entries together.
     * * Entries with the same transaction ID are part of the same transaction.
     */
    transactionId: string;
    /** A note for the entry. */
    note?: string;
} & GenericTimeKeys;
