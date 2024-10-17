import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import type { NotificationRecord } from '@casual-simulation/aux-records';
import { LoadingHelper } from '../LoadingHelper';
import AuthMarker from '../AuthMarker/AuthMarker';
import RelativeTime from '../RelativeTime/RelativeTime';
import AuthPermissions from '../AuthPermissions/AuthPermissions';
import AuthNotification from '../AuthNotification/AuthNotification';

const PAGE_SIZE = 10;

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-marker': AuthMarker,
        'relative-time': RelativeTime,
        'auth-permissions': AuthPermissions,
        'auth-notification': AuthNotification,
    },
})
export default class AuthRecordsNotifications extends Vue {
    private _helper: LoadingHelper<NotificationRecord>;

    @Prop({ required: true })
    recordName: string;

    loading: boolean = false;
    items: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: NotificationRecord[];
    } = {
        mdCount: 0,
        mdPage: 0,
        mdData: [],
        startIndex: 0,
        endIndex: 0,
    };

    selectedItem: NotificationRecord = null;

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

    // getWebhookUrl(webhook: NotificationRecord) {
    //     const url = new URL(
    //         '/api/v2/records/webhook/run',
    //         authManager.client.endpoint
    //     );
    //     url.searchParams.set('recordName', this.recordName);
    //     url.searchParams.set('address', webhook.address);
    //     return url.href;
    // }

    private _reset() {
        this.selectedItem = null;
        this._helper = new LoadingHelper(async (lastItem) => {
            const result = await authManager.client.listNotifications({
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

    onMarkerClick(marker: string) {
        this.permissionsMarker = marker;
    }

    onSelectItem(item: NotificationRecord) {
        this.selectedItem = item;
    }

    async deleteNotification(item: NotificationRecord) {
        const result = await authManager.client.eraseNotification({
            recordName: this.recordName,
            address: item.address,
        });
        if (result.success === true) {
            this.items.mdData = this.items.mdData.filter(
                (i) => i.address !== item.address
            );
        }
    }

    async updatePagination(page: number, pageSize: number) {
        let nextPage = await this._helper.loadPage(page, pageSize);
        if (nextPage) {
            this.items = nextPage;
        }
        return true;
    }
}
