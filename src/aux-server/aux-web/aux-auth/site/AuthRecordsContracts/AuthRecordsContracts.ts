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
import AuthMarker from '../AuthMarker/AuthMarker';
import { LoadingHelper } from '../LoadingHelper';
import AuthPermissions from '../AuthPermissions/AuthPermissions';
import type {
    ContractRecord,
    ContractInvoice,
} from '@casual-simulation/aux-records/contracts';
import AuthAccountBalances from '../AuthAccountBalances/AuthAccountBalances';

const PAGE_SIZE = 10;

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-marker': AuthMarker,
        'auth-permissions': AuthPermissions,
        'auth-balances': AuthAccountBalances,
    },
})
export default class AuthRecordsContracts extends Vue {
    private _helper: LoadingHelper<ContractRecord>;

    @Prop({ required: true })
    recordName: string;

    loading: boolean = false;
    items: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: ContractRecord[];
    } = {
        mdCount: 0,
        mdPage: 0,
        mdData: [],
        startIndex: 0,
        endIndex: 0,
    };

    selectedItem: ContractRecord = null;

    permissionsMarker: string = null;
    permissionsResourceKind: string = null;
    permissionsResourceId: string = null;

    showInvoiceDialog: boolean = false;
    invoiceContractItem: ContractRecord = null;
    invoiceAmount: number = null;
    invoiceNote: string = '';
    invoicePayoutDestination: 'account' | 'stripe' = 'account';
    invoiceLoading: boolean = false;
    invoiceErrorCode: string = null;

    contractInvoices: ContractInvoice[] = [];
    invoicesLoading: boolean = false;

    @Watch('recordName', {})
    onRecordNameChanged(last: string, next: string) {
        if (last !== next) {
            this._reset();
        }
    }

    mounted() {
        this._reset();
    }

    private _reset(page: number = 1) {
        this._helper = new LoadingHelper(async (lastItem) => {
            const result = await authManager.client.listContracts({
                recordName: this.recordName,
                address: lastItem?.address,
            });

            if (result.success === true) {
                return {
                    items: result.items,
                    totalCount: result.totalCount,
                };
            } else {
                return {
                    items: [],
                    totalCount: 0,
                };
            }
        });
        this.selectedItem = null;
        this.items = {
            mdCount: 0,
            mdPage: page,
            mdData: [],
            startIndex: 0,
            endIndex: 0,
        };
        this.loading = false;
        this.showInvoiceDialog = false;
        this.invoiceContractItem = null;
        this.invoiceAmount = null;
        this.invoiceNote = '';
        this.invoicePayoutDestination = 'account';
        this.invoiceErrorCode = null;
        this.invoicePayoutDestination = 'account';
        this.invoiceLoading = false;
        this.invoiceErrorCode = null;
        this.updatePagination(1, PAGE_SIZE);
    }

    changePage(change: number) {
        this.updatePagination(this.items.mdPage + change, PAGE_SIZE);
    }

    async updatePagination(page: number, pageSize: number) {
        let nextPage = await this._helper.loadPage(page, pageSize);
        if (nextPage) {
            this.items = nextPage;
        }
        return true;
    }

    async deleteItem(item: ContractRecord) {
        const result = await authManager.client.eraseContract({
            recordName: this.recordName,
            address: item.address,
        });

        if (result.success === true) {
            this.items.mdData = this.items.mdData.filter(
                (i) => i.address !== item.address
            );
        }
    }

    openInvoiceDialog(item: ContractRecord) {
        this.invoiceContractItem = item;
        this.invoiceAmount = null;
        this.invoiceNote = '';
        this.invoicePayoutDestination = 'account';
        this.invoiceErrorCode = null;
        this.showInvoiceDialog = true;
    }

    closeInvoiceDialog() {
        this.showInvoiceDialog = false;
        this.invoiceContractItem = null;
        this.invoiceAmount = null;
        this.invoiceNote = '';
        this.invoicePayoutDestination = 'account';
        this.invoiceErrorCode = null;
    }

    async submitInvoice() {
        if (!this.invoiceContractItem || !this.invoiceAmount) {
            return;
        }

        this.invoiceLoading = true;
        this.invoiceErrorCode = null;

        try {
            const result = await authManager.client.invoiceContract({
                contractId: this.invoiceContractItem.id,
                amount: this.invoiceAmount,
                note: this.invoiceNote || undefined,
                payoutDestination: this.invoicePayoutDestination,
            });

            if (result.success === true) {
                this.closeInvoiceDialog();
            } else {
                this.invoiceErrorCode = result.errorCode;
            }
        } catch (err) {
            console.error('Error invoicing contract:', err);
            this.invoiceErrorCode = 'error';
        } finally {
            this.invoiceLoading = false;
        }
    }

    onMarkerClick(marker: string) {
        this.permissionsMarker = marker;
    }

    onItemClick(item: ContractRecord) {
        this.selectedItem = item;

        if (!item) {
            this.permissionsMarker = null;
            this.permissionsResourceKind = null;
            this.permissionsResourceId = null;
            this.contractInvoices = [];
            return;
        }
        this.permissionsResourceKind = 'contract';
        this.permissionsResourceId = item.address;
        this.loadInvoices(item);
    }

    private async loadInvoices(item: ContractRecord) {
        this.invoicesLoading = true;
        try {
            const result = await authManager.client.listContractInvoices({
                contractId: item.id,
            });

            if (result.success === true) {
                this.contractInvoices = result.items;
            } else {
                this.contractInvoices = [];
            }
        } catch (err) {
            console.error('Error loading invoices:', err);
            this.contractInvoices = [];
        } finally {
            this.invoicesLoading = false;
        }
    }
}
