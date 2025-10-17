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
import { Prop, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import type { AccountBalance } from '@casual-simulation/aux-common';

@Component({
    components: {
        'svg-icon': SvgIcon,
    },
})
export default class AuthAccountBalances extends Vue {
    @Prop({ required: false, default: null })
    userId: string | null;

    @Prop({ required: false, default: null })
    contractId: string | null;

    @Prop({ required: false, default: null })
    studioId: string | null;

    loading: boolean = false;
    error: string | null = null;
    balances: Record<string, AccountBalance> = {};

    get filteredBalances(): Array<{
        currency: string;
        balance: AccountBalance;
    }> {
        return Object.entries(this.balances)
            .filter(([currency]) => currency !== 'success')
            .map(([currency, balance]) => ({
                currency,
                balance,
            }));
    }

    @Watch('userId')
    @Watch('contractId')
    @Watch('studioId')
    onFiltersChanged() {
        this._loadBalances();
    }

    mounted() {
        this._loadBalances();
    }

    private async _loadBalances() {
        // Ensure at least one filter is provided
        if (!this.userId && !this.contractId && !this.studioId) {
            this.error =
                'At least one of userId, contractId, or studioId must be provided';
            this.balances = {};
            return;
        }

        this.loading = true;
        this.error = null;
        this.balances = {};

        try {
            const params: any = {};
            if (this.userId) {
                params.userId = this.userId;
            }
            if (this.contractId) {
                params.contractId = this.contractId;
            }
            if (this.studioId) {
                params.studioId = this.studioId;
            }

            const result = await authManager.client.getBalances(params);

            if (result.success === true) {
                this.balances = result;
            } else {
                this.error = result.errorMessage || 'Failed to load balances';
            }
        } catch (err: any) {
            this.error =
                err?.message || 'An error occurred while loading balances';
        } finally {
            this.loading = false;
        }
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

            // Format to 2 decimal places
            return Number(netBalance).toFixed(2);
        } catch (err) {
            return 'N/A';
        }
    }
}
