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

/**
 * Represents the balance of a financial account.
 */
export class AccountBalance {
    /**
     * The ID of the account.
     */
    accountId: string;

    /**
     * The number of credits to the account.
     */
    credits: bigint;

    /**
     * The number of pending credits to the account.
     */
    pendingCredits: bigint;

    /**
     * The number of debits to the account.
     */
    debits: bigint;

    /**
     * The number of pending debits to the account.
     */
    pendingDebits: bigint;

    /**
     * The factor that should be used to convert between credits and USD.
     */
    displayFactor: bigint;

    /**
     * The currency that the account is in.
     */
    currency: string;

    constructor(data: {
        accountId: string;
        credits: bigint | string;
        pendingCredits: bigint | string;
        debits: bigint | string;
        pendingDebits: bigint | string;
        displayFactor: bigint | string;
        currency: string;
    }) {
        this.accountId = data.accountId;
        this.credits =
            typeof data.credits === 'string'
                ? BigInt(data.credits)
                : data.credits;
        this.pendingCredits =
            typeof data.pendingCredits === 'string'
                ? BigInt(data.pendingCredits)
                : data.pendingCredits;
        this.debits =
            typeof data.debits === 'string' ? BigInt(data.debits) : data.debits;
        this.pendingDebits =
            typeof data.pendingDebits === 'string'
                ? BigInt(data.pendingDebits)
                : data.pendingDebits;
        this.displayFactor =
            typeof data.displayFactor === 'string'
                ? BigInt(data.displayFactor)
                : data.displayFactor;
        this.currency = data.currency;
    }

    toJSON(): JSONAccountBalance {
        return {
            accountId: this.accountId,
            credits: this.credits.toString(),
            pendingCredits: this.pendingCredits.toString(),
            debits: this.debits.toString(),
            pendingDebits: this.pendingDebits.toString(),
            displayFactor: this.displayFactor.toString(),
            currency: this.currency,
        };
    }
}

/**
 * Represents the balance of a financial account in a JSON-compatible format.
 */
export interface JSONAccountBalance {
    /**
     * The ID of the account.
     */
    accountId: string;

    /**
     * The number of credits to the account.
     */
    credits: string;

    /**
     * The number of pending credits to the account.
     */
    pendingCredits: string;

    /**
     * The number of debits to the account.
     */
    debits: string;

    /**
     * The number of pending debits to the account.
     */
    pendingDebits: string;

    /**
     * The factor that should be used to convert between credits and USD.
     */
    displayFactor: string;

    /**
     * The currency that the account is in.
     */
    currency: CurrencyCodesType;
}
