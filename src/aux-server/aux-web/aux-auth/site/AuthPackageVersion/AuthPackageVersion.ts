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
    WebhookInfoFile,
    WebhookRecord,
    WebhookRunInfo,
} from '@casual-simulation/aux-records';
import { LoadingHelper } from '../LoadingHelper';
import AuthMarker from '../AuthMarker/AuthMarker';
import RelativeTime from '../RelativeTime/RelativeTime';
import AuthPermissions from '../AuthPermissions/AuthPermissions';
import axios from 'axios';
import type {
    PackageRecordVersion,
    PackageRecordVersionKey,
} from '@casual-simulation/aux-records/packages/version';
import { formatVersionNumber } from '@casual-simulation/aux-common';
import DataSize from '../DataSize/DataSize';

const PAGE_SIZE = 10;

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-marker': AuthMarker,
        'relative-time': RelativeTime,
        'data-size': DataSize,
        'auth-permissions': AuthPermissions,
    },
})
export default class AuthPackageVersion extends Vue {
    // private _helper: LoadingHelper<WebhookRunInfo>;

    @Prop({ required: true })
    version: PackageRecordVersion;

    // isLoadingFile: boolean = false;

    @Watch('run')
    onRunChanged() {
        // this._reset();
    }

    created() {
        // this.isLoadingFile = false;
    }

    mounted() {
        // this._reset();
    }

    formatKey(key: PackageRecordVersionKey) {
        return formatVersionNumber(key.major, key.minor, key.patch, key.tag);
    }

    // private async _reset() {
    //     this.runFile = await this._getRunFile();
    // }

    // private async _getRunFile(): Promise<WebhookInfoFile> {
    //     if (this.run && this.run.infoRecordName && this.run.infoFileName) {
    //         try {
    //             this.isLoadingFile = true;
    //             const runInfo = await authManager.client.getWebhookRun({
    //                 runId: this.run.runId,
    //             });

    //             if (runInfo.success === true) {
    //                 if (runInfo.infoFileResult.success === true) {
    //                     const result = await axios.request({
    //                         method: runInfo.infoFileResult.requestMethod,
    //                         url: runInfo.infoFileResult.requestUrl,
    //                         headers: runInfo.infoFileResult.requestHeaders,
    //                     });

    //                     return result.data as WebhookInfoFile;
    //                 }
    //             }
    //         } finally {
    //             this.isLoadingFile = false;
    //         }
    //     }
    //     return null;
    // }

    // changePage(change: number) {
    //     this.updatePagination(this.items.mdPage + change, PAGE_SIZE);
    // }

    // onSelectItem(item: WebhookRunInfo) {
    //     this.selectedItem = item;
    // }

    // async updatePagination(page: number, pageSize: number) {
    //     let nextPage = await this._helper.loadPage(page, pageSize);
    //     if (nextPage) {
    //         this.items = nextPage;
    //     }
    //     return true;
    // }
}
