import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import type {
    NotificationRecord,
    NotificationSubscription,
    WebhookRunInfo,
} from '@casual-simulation/aux-records';
import { LoadingHelper } from '../LoadingHelper';
import AuthMarker from '../AuthMarker/AuthMarker';
import RelativeTime from '../RelativeTime/RelativeTime';
// import AuthPermissions from '../AuthPermissions/AuthPermissions';
// import AuthWebhookRun from '../AuthWebhookRun/AuthWebhookRun';

const PAGE_SIZE = 10;

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-marker': AuthMarker,
        'relative-time': RelativeTime,
        // 'webhook-run': AuthWebhookRun,
    },
})
export default class AuthNotification extends Vue {
    private _subscriptionsHelper: LoadingHelper<NotificationSubscription>;

    @Prop({ required: true })
    recordName: string;

    @Prop({ required: true })
    notification: NotificationRecord;

    loading: boolean = false;
    subscriptions: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: NotificationSubscription[];
    } = {
        mdCount: 0,
        mdPage: 0,
        mdData: [],
        startIndex: 0,
        endIndex: 0,
    };

    selectedSubscription: NotificationSubscription = null;

    @Watch('recordName', {})
    onRecordNameChanged(last: string, next: string) {
        if (last !== next) {
            this._reset();
        }
    }

    @Watch('notification', {})
    onNotificationChanged(last: NotificationRecord, next: NotificationRecord) {
        if (last?.address !== next?.address) {
            this._reset();
        }
    }

    mounted() {
        this._reset();
    }

    private _reset() {
        this._subscriptionsHelper = new LoadingHelper(async (lastItem) => {
            const result =
                await authManager.client.listNotificationSubscriptions({
                    recordName: this.recordName,
                    address: this.notification.address,
                });

            if (result.success === true) {
                return {
                    items: result.subscriptions,
                    totalCount: result.subscriptions.length,
                };
            } else {
                return {
                    items: [],
                    totalCount: 0,
                };
            }
        });
        this.subscriptions = {
            mdCount: 0,
            mdPage: 0,
            mdData: [],
            startIndex: 0,
            endIndex: 0,
        };
        this.loading = false;
        this.updatePagination(1, PAGE_SIZE);
    }

    onSelectSubscription(item: NotificationSubscription) {
        this.selectedSubscription = item;
    }

    async updatePagination(page: number, pageSize: number) {
        let nextPage = await this._subscriptionsHelper.loadPage(page, pageSize);
        if (nextPage) {
            this.subscriptions = nextPage;
        }
        return true;
    }
}
