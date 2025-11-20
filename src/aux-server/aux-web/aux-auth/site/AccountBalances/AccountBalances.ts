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
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import { SvgIcon } from '@casual-simulation/aux-components';
import type { AccountBalance } from '@casual-simulation/aux-common';
import type { AccountBalances } from '@casual-simulation/aux-records';

@Component({
    components: {
        'svg-icon': SvgIcon,
    },
})
export default class AccountBalancesVue extends Vue {
    @Prop({ required: true })
    balances: AccountBalances;

    get accountBalances(): AccountBalance[] {
        if (!this.balances) {
            return [];
        }
        return [this.balances.usd, this.balances.credits].filter((b) => b);
    }

    formatBalance(value: bigint | number): string {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return String(value);
    }

    calculateNetBalance(balance: AccountBalance): string {
        try {
            // Calculate net balance: (credits - (debits)) / displayFactor
            const netBalance = balance.freeCreditBalance();
            return this.formatCurrency(
                balance.currency,
                netBalance,
                balance.displayFactor
            );
        } catch (err) {
            return 'N/A';
        }
    }

    hasPendingBalance(balance: AccountBalance): boolean {
        return (
            BigInt(balance.pendingDebits) > 0n ||
            BigInt(balance.pendingCredits) > 0n
        );
    }

    calculatePendingBalance(balance: AccountBalance): string {
        try {
            const pendingCredits = BigInt(balance.pendingCredits);
            const pendingDebits = BigInt(balance.pendingDebits);
            const displayFactor = BigInt(balance.displayFactor);
            return this.formatCurrency(
                balance.currency,
                pendingCredits - pendingDebits,
                displayFactor
            );
        } catch (err) {
            return 'N/A';
        }
    }

    formatCurrency(
        currency: string,
        value: bigint,
        displayFactor: bigint
    ): string {
        let remainder = value % displayFactor;
        let displayValue = value / displayFactor;
        const symbol = currency === 'usd' ? '$' : '';

        // Format to 2 decimal places
        const sign = value < 0n ? '-' : '';

        if (remainder < 0n) {
            remainder = -remainder;
        }
        if (displayValue < 0n) {
            displayValue = -displayValue;
        }

        return `${sign}${symbol}${displayValue.toString()}.${remainder
            .toString()
            .padStart(2, '0')}`;
    }

    getCurrencyName(currency: string) {
        if (currency === 'usd') {
            return 'USD';
        } else if (currency === 'credits') {
            return 'Credits';
        }
        return currency.toUpperCase();
    }
}
