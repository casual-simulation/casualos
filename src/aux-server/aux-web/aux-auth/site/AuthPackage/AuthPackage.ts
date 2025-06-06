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
import type { PackageRecord } from '@casual-simulation/aux-records';
import { LoadingHelper } from '../LoadingHelper';
import AuthMarker from '../AuthMarker/AuthMarker';
import RelativeTime from '../RelativeTime/RelativeTime';
import type {
    PackageRecordVersion,
    PackageRecordVersionKey,
} from '@casual-simulation/aux-records/packages/version';
import { formatVersionNumber } from '@casual-simulation/aux-common';
import AuthPackageVersion from '../AuthPackageVersion/AuthPackageVersion';
import DataSize from '../DataSize/DataSize';

const PAGE_SIZE = 10;

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-marker': AuthMarker,
        'relative-time': RelativeTime,
        'data-size': DataSize,
        'package-version': AuthPackageVersion,
    },
})
export default class AuthPackage extends Vue {
    private _helper: LoadingHelper<PackageRecordVersion>;

    @Prop({ required: true })
    recordName: string;

    @Prop({ required: true })
    pkg: PackageRecord;

    loading: boolean = false;
    items: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: PackageRecordVersion[];
    } = {
        mdCount: 0,
        mdPage: 0,
        mdData: [],
        startIndex: 0,
        endIndex: 0,
    };

    selectedItem: PackageRecordVersion = null;

    @Watch('recordName', {})
    onRecordNameChanged(last: string, next: string) {
        if (last !== next) {
            this._reset();
        }
    }

    @Watch('pkg', {})
    onPackageChanged(last: PackageRecord, next: PackageRecord) {
        if (last?.address !== next?.address) {
            this._reset();
        }
    }

    mounted() {
        this._reset();
    }

    private _reset() {
        this._helper = new LoadingHelper(async (lastItem) => {
            const result = await authManager.client.listPackageVersions({
                recordName: this.recordName,
                address: this.pkg.address,
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
            mdPage: 0,
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

    onSelectItem(item: PackageRecordVersion) {
        this.selectedItem = item;
    }

    async updatePagination(page: number, pageSize: number) {
        let nextPage = await this._helper.loadPage(page, pageSize);
        if (nextPage) {
            this.items = nextPage;
        }
        return true;
    }

    formatKey(key: PackageRecordVersionKey) {
        return formatVersionNumber(key.major, key.minor, key.patch, key.tag);
    }

    async deleteVersion(item: PackageRecordVersion) {
        const result = await authManager.client.erasePackageVersion({
            recordName: this.recordName,
            address: item.address,
            key: item.key,
        });
        if (result.success === true) {
            this.items.mdData = this.items.mdData.filter(
                (i) =>
                    i.address !== item.address &&
                    !(
                        item.key.major === i.key.major &&
                        item.key.minor === i.key.minor &&
                        item.key.patch === i.key.patch &&
                        item.key.tag === i.key.tag
                    )
            );
        }
    }
}
