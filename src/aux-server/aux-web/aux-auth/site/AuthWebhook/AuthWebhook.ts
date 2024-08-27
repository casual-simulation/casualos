import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import type {
    WebhookRecord,
    WebhookRunInfo,
} from '@casual-simulation/aux-records';
import { LoadingHelper } from '../LoadingHelper';
import AuthMarker from '../AuthMarker/AuthMarker';
import RelativeTime from '../RelativeTime/RelativeTime';
import AuthPermissions from '../AuthPermissions/AuthPermissions';

const PAGE_SIZE = 10;

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-marker': AuthMarker,
        'relative-time': RelativeTime,
        'auth-permissions': AuthPermissions,
    },
})
export default class AuthWebhook extends Vue {
    private _helper: LoadingHelper<WebhookRunInfo>;

    @Prop({ required: true })
    recordName: string;

    @Prop({ required: true })
    webhook: WebhookRecord;

    loading: boolean = false;
    items: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: WebhookRunInfo[];
    } = {
        mdCount: 0,
        mdPage: 0,
        mdData: [],
        startIndex: 0,
        endIndex: 0,
    };

    selectedItem: WebhookRecord = null;

    @Watch('recordName', {})
    onRecordNameChanged(last: string, next: string) {
        if (last !== next) {
            this._reset();
        }
    }

    @Watch('webhook', {})
    onWebhookChanged(last: WebhookRecord, next: WebhookRecord) {
        if (last?.address !== next?.address) {
            this._reset();
        }
    }

    mounted() {
        this._reset();
    }

    getWebhookUrl(webhook: WebhookRecord) {
        const url = new URL(
            '/api/v2/records/webhook/run',
            authManager.client.endpoint
        );
        url.searchParams.set('recordName', this.recordName);
        url.searchParams.set('address', webhook.address);
        return url.href;
    }

    private _reset() {
        this._helper = new LoadingHelper(async (lastItem) => {
            const result = await authManager.client.listWebhookRuns({
                recordName: this.recordName,
                address: this.webhook.address,
                requestTimeMs: lastItem?.requestTimeMs,
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

    async updatePagination(page: number, pageSize: number) {
        let nextPage = await this._helper.loadPage(page, pageSize);
        if (nextPage) {
            this.items = nextPage;
        }
        return true;
    }
}
