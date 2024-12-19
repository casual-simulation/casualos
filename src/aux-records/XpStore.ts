import { Account } from './financial/Types';
import { AuthUser } from './AuthStore';
import {
    SuccessResult,
    GenericTimeKeys,
    GigQty,
    CurrencySFU,
    ReduceKeysToPrimitives,
} from './TypeUtils';

export type XpStore = {
    /**
     * Get an xp contract by its id
     * @param contractId The id of the contract to get
     */
    getXpContract: (
        contractId: XpContract['id']
    ) => Promise<ReduceKeysToPrimitives<XpContract>>;

    /**
     * Get an xp invoice by its id
     * @param invoiceId The id of the invoice to get
     */
    getXpInvoice: (
        invoiceId: XpInvoice['id']
    ) => Promise<ReduceKeysToPrimitives<XpInvoice>>;

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
     * Save an xp contract with an associated account
     * @param contract The contract to save
     * @param account The account to save
     */
    saveXpContract: (contract: XpContract) => Promise<void>;

    /**
     * Save an xp invoice
     * @param invoice The invoice to save
     */
    saveXpInvoice: (invoice: XpInvoice) => Promise<void>;

    /**
     * Save an xp user associated with the given auth user
     * @param id The id of the xp user to create an account for (uuid) not the auth user id
     * @param user The meta data to associate with the user
     */
    saveXpUser: (id: XpUser['id'], user: XpUser) => Promise<void>;

    /**
     * Updates an Xp contract
     * * Will throw an error if not successful (e.g. contract not found or invalid update)
     * @param id The id of the contract to update
     * @param config The configuration to update the contract with
     */
    updateXpContract: (
        id: XpContract['id'],
        config: Partial<Omit<XpContract, 'id' | 'createdAt'>>
    ) => Promise<SuccessResult<true, { contract: DataBaseM<XpContract> }>>;
};

type DataBaseM<M> = ReduceKeysToPrimitives<M>;

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
    accountId: Account['id'];
    /** The rate at which the user is requesting payment (null if not yet specified) */
    requestedRate: CurrencySFU | null;
    /** The users unique id from the Auth system */
    userId: string;
}

/**
 * Mimics a "Smart Contract" (crypto/blockchain) data model for the xp system
 */
export interface XpContract extends ModelBase {
    /** The id of the account associated with the contract */
    accountId: Account['id'] | null;
    /** A description of the contract, may contain useful query meta */
    description: string | null;
    /** The id of the user holding the contract */
    holdingUserId: XpUser['id'] | null;
    /** The id of the user issuing the contract */
    issuerUserId: XpUser['id'];
    /** The rate at which the entirety of the contract is worth */
    rate: CurrencySFU;
    /** An amount of money associated with a contract offer (would be the amount in the contract account if accepted) */
    offeredWorth: CurrencySFU | null;
    /** The status of the contract */
    status: 'open' | 'pending_transfer' | 'closed' | 'draft';
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
