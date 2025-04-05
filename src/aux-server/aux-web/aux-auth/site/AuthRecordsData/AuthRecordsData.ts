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
import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import type {
    ListDataResult,
    ListDataSuccess,
} from '@casual-simulation/aux-records';
import AuthMarker from '../AuthMarker/AuthMarker';
import { LoadingHelper } from '../LoadingHelper';
import AuthPermissions from '../AuthPermissions/AuthPermissions';

const PAGE_SIZE = 10;

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-marker': AuthMarker,
        'auth-permissions': AuthPermissions,
    },
})
export default class AuthRecordsData extends Vue {
    private _helper: LoadingHelper<ListDataSuccess['items'][0]>;

    @Prop({ required: true })
    recordName: string;

    loading: boolean = false;
    items: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: ListDataSuccess['items'];
    } = {
        mdCount: 0,
        mdPage: 0,
        mdData: [],
        startIndex: 0,
        endIndex: 0,
    };

    permissionsMarker: string = null;
    permissionsResourceKind: string = null;
    permissionsResourceId: string = null;

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
            const result = await authManager.client.listData({
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
        this.items = {
            mdCount: 0,
            mdPage: page,
            mdData: [],
            startIndex: 0,
            endIndex: 0,
        };
        this.loading = false;
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

    async deleteItem(item: ListDataSuccess['items'][0]) {
        const result = await authManager.client.eraseData({
            recordKey: this.recordName,
            address: item.address,
        });

        if (result.success === true) {
            this.items.mdData = this.items.mdData.filter(
                (i) => i.address !== item.address
            );
        }
    }

    onMarkerClick(marker: string) {
        this.permissionsMarker = marker;
    }

    onItemClick(item: ListDataSuccess['items'][0]) {
        this.permissionsResourceKind = 'data';
        this.permissionsResourceId = item.address;
    }
}
