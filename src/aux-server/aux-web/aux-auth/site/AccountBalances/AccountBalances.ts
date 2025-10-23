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
            let credits = BigInt(balance.credits);
            let debits = BigInt(balance.debits);
            let displayFactor = BigInt(balance.displayFactor);

            // Calculate net balance: (credits - debits) / displayFactor
            const netBalance = (credits - debits) / displayFactor;

            const symbol = balance.currency === 'usd' ? '$' : '';

            // Format to 2 decimal places
            return symbol + Number(netBalance).toFixed(2);
        } catch (err) {
            return 'N/A';
        }
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
