import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import type {
    ListDataResult,
    ListDataSuccess,
} from '@casual-simulation/aux-records';

const PAGE_SIZE = 10;

@Component({
    components: {
        'svg-icon': SvgIcon,
    },
})
export default class AuthRecordsData extends Vue {
    private _helper: LoadingHelper<ListDataSuccess['items'][0]>;

    loading: boolean = false;
    items: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: ListDataSuccess['items'];
    } = {
        mdCount: 100,
        mdPage: 0,
        mdData: [],
        startIndex: 0,
        endIndex: 0,
    };

    get recordName() {
        return this.$route.params.recordName;
    }

    @Watch('recordName', {})
    onRecordNameChanged(last: string, next: string) {
        if (last !== next) {
            console.log('changed', last, next);
            this.updatePagination(1, PAGE_SIZE);
        }
    }

    created() {
        this._helper = new LoadingHelper(async (lastItem) => {
            let items =
                (await authManager.listData(
                    this.recordName,
                    lastItem?.address
                )) ?? [];
            return {
                items,
                totalCount: 100,
            };
        });
        this.items = {
            mdCount: 100,
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

class LoadingHelper<T> {
    items: T[] = [];
    count: number = 0;

    private _currentRequest: Promise<TablePage<T>>;

    private _makeRequest: (lastItem: T) => Promise<LoadedPage<T>>;

    constructor(makeRequest: (lastItem: T) => Promise<LoadedPage<T>>) {
        this._makeRequest = makeRequest;
    }

    loadPage(page: number, pageSize: number): Promise<TablePage<T>> {
        console.log('load', page, pageSize);
        if (!this._currentRequest) {
            console.log('none');
            this._currentRequest = this._loadPage(page, pageSize).then(
                (result) => {
                    console.log('done');
                    this._currentRequest = null;
                    return result;
                }
            );
            console.log('req', this._currentRequest);
            return this._currentRequest;
        } else {
            this._currentRequest = this._currentRequest.then(() => {
                return this._loadPage(page, pageSize);
            });
            return this._currentRequest;
        }
    }

    private async _loadPage(
        page: number,
        pageSize: number
    ): Promise<TablePage<T>> {
        let index = (page - 1) * pageSize;
        if (index >= this.items.length) {
            if (await this._loadMoreItems()) {
                const items = this.items.slice(index, index + pageSize);
                return {
                    mdCount: this.count,
                    mdPage: page,
                    mdData: items,
                    startIndex: index,
                    endIndex: index + items.length,
                };
            } else {
                return null;
            }
        }
        const items = this.items.slice(index, index + pageSize);
        return {
            mdCount: this.count,
            mdPage: page,
            mdData: items,
            startIndex: index,
            endIndex: index + items.length,
        };
    }

    private async _loadMoreItems(): Promise<boolean> {
        try {
            const lastItem = this.items[this.items.length - 1];
            console.log('more', lastItem);
            // console.log('last', lastAddress);
            let results = await this._makeRequest(lastItem);
            this.items = this.items.concat(results.items);
            this.count = results.totalCount;
            return results.items.length > 0;
        } catch (err) {
            console.error(err);
            return false;
        }
    }
}

interface LoadedPage<T> {
    items: T[];
    totalCount: number;
}

interface TablePage<T> {
    mdData: T[];
    mdCount: number;
    mdPage: number;
    startIndex: number;
    endIndex: number;
}
