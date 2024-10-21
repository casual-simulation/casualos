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

const PAGE_SIZE = 10;

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-marker': AuthMarker,
        'relative-time': RelativeTime,
        'auth-permissions': AuthPermissions,
    },
})
export default class AuthWebhookRun extends Vue {
    // private _helper: LoadingHelper<WebhookRunInfo>;

    @Prop({ required: true })
    run: WebhookRunInfo;

    runFile: WebhookInfoFile = null;

    isLoadingFile: boolean = false;

    get runDuration() {
        return this.run.responseTimeMs - this.run.requestTimeMs;
    }

    @Watch('run')
    onRunChanged() {
        this.runFile = null;
        this._reset();
    }

    created() {
        this.runFile = null;
        this.isLoadingFile = false;
    }

    mounted() {
        this._reset();
    }

    private async _reset() {
        this.runFile = await this._getRunFile();
    }

    private async _getRunFile(): Promise<WebhookInfoFile> {
        if (this.run && this.run.infoRecordName && this.run.infoFileName) {
            try {
                this.isLoadingFile = true;
                const runInfo = await authManager.client.getWebhookRun({
                    runId: this.run.runId,
                });

                if (runInfo.success === true) {
                    if (runInfo.infoFileResult.success === true) {
                        const result = await axios.request({
                            method: runInfo.infoFileResult.requestMethod,
                            url: runInfo.infoFileResult.requestUrl,
                            headers: runInfo.infoFileResult.requestHeaders,
                        });

                        return result.data as WebhookInfoFile;
                    }
                }
            } finally {
                this.isLoadingFile = false;
            }
        }
        return null;
    }

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
