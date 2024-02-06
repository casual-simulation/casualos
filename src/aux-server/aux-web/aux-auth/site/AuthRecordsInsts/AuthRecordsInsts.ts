import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import type {
    InstRecord,
    ListInstsSuccess,
} from '@casual-simulation/aux-records';
import AuthMarker from '../AuthMarker/AuthMarker';
import { LoadingHelper } from '../LoadingHelper';
import AuthPermissions from '../AuthPermissions/AuthPermissions';

const PAGE_SIZE = 10;

declare const FRONTEND_ORIGIN: string;

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-marker': AuthMarker,
        'auth-permissions': AuthPermissions,
    },
})
export default class AuthRecordsInsts extends Vue {
    private _helper: LoadingHelper<ListInstsSuccess['insts'][0]>;

    @Prop({ required: true })
    recordName: string;

    loading: boolean = false;
    items: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: ListInstsSuccess['insts'];
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
            let result = await authManager.listInsts(
                this.recordName,
                lastItem?.inst
            );

            if (result) {
                return {
                    items: result.insts,
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

    getInstUrl(inst: InstRecord): string {
        const origin = FRONTEND_ORIGIN ?? window.location.origin;
        let url = new URL(origin);
        url.searchParams.set('owner', this.recordName);
        url.searchParams.set('inst', inst.inst);
        url.searchParams.set('gridPortal', 'home');
        return url.href;
    }

    async updatePagination(page: number, pageSize: number) {
        let nextPage = await this._helper.loadPage(page, pageSize);
        if (nextPage) {
            this.items = nextPage;
        }
        return true;
    }

    async deleteInst(item: InstRecord) {
        const result = await authManager.deleteInst(this.recordName, item.inst);
        if (result.success === true) {
            this.items.mdData = this.items.mdData.filter(
                (i) => i.inst !== item.inst
            );
        }
    }

    onMarkerClick(marker: string) {
        this.permissionsMarker = marker;
    }

    onItemClick(item: ListInstsSuccess['insts'][0]) {
        this.permissionsResourceKind = 'inst';
        this.permissionsResourceId = item.inst;
    }
}
