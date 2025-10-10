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
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from '../crud';
import type { SubscriptionFilter } from '../MetricsStore';

/**
 * Defines a store that contains notification records.
 */
export interface ContractRecordsStore extends CrudRecordsStore<ContractRecord> {
    /**
     * Gets the item metrics for the subscription of the given user or studio.
     * @param filter The filter to use.
     */
    getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<ContractSubscriptionMetrics>;

    /**
     * Marks the given pending contract as open.
     * @param recordName The name of the record.
     * @param address The address of the contract.
     */
    markPendingContractAsOpen(
        recordName: string,
        address: string
    ): Promise<void>;

    /**
     * Marks the given contract as closed.
     * @param recordName The name of the record.
     * @param address The address of the contract.
     */
    markContractAsClosed(recordName: string, address: string): Promise<void>;

    /**
     * Getes the contract record with the given ID.
     * @param id The ID of the contract to get.
     */
    getItemById(id: string): Promise<{
        recordName: string;
        contract: ContractRecord;
    } | null>;
}

/**
 * Defines a record that represents a notification.
 * That is, a way for users to be notified of something.
 *
 * @dochash types/records/packages
 * @docName ContractRecord
 */
export interface ContractRecord extends CrudRecord {
    /**
     * The ID of the contract.
     */
    id: string;

    /**
     * The ID of the user that issued the contract.
     * That is, the user who created the contract in the record.
     * (Similar to subjectId in other record types)
     */
    issuingUserId: string;

    /**
     * The ID of the user that is holding the contract.
     * That is, the user who is currently responsible for fulfilling the contract.
     */
    holdingUserId: string;

    /**
     * The current status of the contract.
     */
    status: ContractStatus;

    /**
     * The unix time in miliseconds when the contract was initially issued.
     */
    issuedAtMs: number;

    /**
     * The unix time in miliseconds when the contract was closed.
     */
    closedAtMs?: number | null;

    /**
     * The rate at which the contract is paid.
     * This is the amount of money that each gig is worth.
     */
    rate: number;

    /**
     * The initial value of the contract.
     * This is the total value of what the contract was worth when it was created.
     */
    initialValue: number;

    /**
     * The description of the contract.
     */
    description?: string | null;

    /**
     * The ID of the checkout session that was created to pay for the contract, if applicable.
     */
    stripeCheckoutSessionId?: string | null;

    /**
     * The ID of the payment intent that was created to pay for the contract, if applicable.
     */
    stripePaymentIntentId?: string | null;
}

/**
 * The status of a contract.
 * - "pending" means the contract is awaiting purchase.
 * - "open" means the contract is active and can be invoiced.
 * - "closed" means the contract is no longer active and cannot be invoiced.
 */
export type ContractStatus = 'pending' | 'open' | 'closed';

/**
 * Represents an invoice against a contract.
 */
export interface ContractInvoice {
    /**
     * The ID of the invoice.
     */
    id: string;

    /**
     * The ID of the contract that this invoice is for.
     */
    contractId: string;

    /**
     * The amount charged in the invoice.
     */
    amount: number;

    /**
     * The current status of the invoice.
     */
    status: InvoiceStatus;

    /**
     * The unix time in milliseconds when the invoice was opened.
     */
    openedAtMs: number;

    /**
     * The unix time in miliseconds when the invoice was paid, if applicable.
     */
    paidAtMs?: number | null;

    /**
     * The unix time in milliseconds when the invoice was voided, if applicable.
     */
    voidedAtMs?: number | null;

    /**
     * The destination for the payout of the invoice.
     */
    payoutDestination: InvoicePayoutDestination;

    /**
     * The ID of the external transfer that was created to payout the invoice, if applicable.
     * Null if the invoice is not paid or the payout destination is "account".
     */
    destinationTransferId?: string | null;

    /**
     * The reason why the invoice was voided, if applicable.
     */
    voidReason?: InvoiceVoidReason | null;

    /**
     * The ID of the transaction that paid the invoice, if applicable.
     */
    transactionId?: string | null;

    /**
     * The ID of the external payout that was created as part of the invoice payment process, if applicatble.
     * Null if the invoice is not paid or the payout destination is "account".
     */
    externalPayoutId?: string | null;

    /**
     * An additional note about the invoice.
     */
    note?: string | null;

    /**
     * The unix time in milliseconds when the invoice was created.
     */
    createdAtMs: number;

    /**
     * The unix time in milliseconds when the invoice was last updated.
     */
    updatedAtMs: number;
}

/**
 * Represents the process of transferring funds from a user's account to an external destination.
 */
export interface ExternalPayout {
    /**
     * The ID of the payout.
     */
    id: string;

    /**
     * The ID of the user that this payout is for.
     */
    userId: string;

    /**
     * The ID of the invoice that this payout is assocated with, if applicable.
     */
    invoiceId?: string | null;

    /**
     * The ID of the transfer in the financial system that represents the payout.
     */
    transferId: string;

    /**
     * The ID of the transaction that was created to transfer the funds.
     */
    transactionId: string;

    /**
     * The external destination for the transfer.
     */
    externalDestination: 'stripe';

    /**
     * The ID of the stripe transfer that was created to transfer the funds.
     */
    stripeTransferId: string | null;

    /**
     * The stripe account ID that the payout is being sent to.
     */
    destinationStripeAccountId: string | null;

    /**
     * The amount of the transfer.
     */
    amount: number;

    /**
     * The ID of the transfer that posted the original transfer.
     */
    postedTransferId?: string | null;

    /**
     * The ID of the transfer that voided the original transfer, if applicable.
     */
    voidedTransferId?: string | null;

    /**
     * The unix time in milliseconds when the payout was initiated.
     */
    initatedAtMs?: number | null;

    /**
     * The unix time in milliseconds when the payout was posted.
     */
    postedAtMs?: number | null;

    /**
     * The unix time in miliseconds when the payout was voided, if applicable.
     */
    voidedAtMs?: number | null;
}

/**
 * The status of an invoice.
 * - "open" means the invoice is pending payment.
 * - "paid" means the invoice has been paid.
 * - "void" means the invoice has been voided and is no longer valid.
 */
export type InvoiceStatus = 'open' | 'paid' | 'void';

/**
 * The destination for the payout of an invoice.
 * - "stripe" means that the invoiced amount will be transfered to the users Stripe account once paid.
 * - "account" means that the invoiced amount will remain in thier CasualOS account.
 */
export type InvoicePayoutDestination = 'stripe' | 'account';

/**
 * The reason why an invoice was voided.
 * - "rejected" means the invoice was rejected by the contract issuer, the system, or an admin.
 * - "cancelled" means the invoice was cancelled by the user, the system, or an admin.
 */
export type InvoiceVoidReason = 'rejected' | 'cancelled';

export interface ContractSubscriptionMetrics extends CrudSubscriptionMetrics {
    /**
     * The total number of packages stored in the subscription.
     */
    totalItems: number;
}
