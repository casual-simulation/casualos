import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../../shared/AppManager';
import { Prop, Watch } from 'vue-property-decorator';
import BuilderApp from '../BuilderApp/BuilderApp';
import { SubscriptionLike } from 'rxjs';
import { TreeView } from 'vue-json-tree-view';
import { searchFileState } from '@casual-simulation/aux-common';
import { values } from 'lodash';

@Component({
    components: {
        'tree-view': TreeView,
    },
})
export default class AuxDebug extends Vue {
    auxJson: any = null;
    includeDestroyed: boolean = false;
    search: string = '';
    error: string;

    private _subs: SubscriptionLike[];

    get fileManager() {
        return appManager.simulationManager.primary;
    }

    get app() {
        return <BuilderApp>this.$parent.$parent;
    }

    constructor() {
        super();
        this.auxJson = null;
        this.search = '';
        this.error = null;
        this.includeDestroyed = false;
    }

    created() {
        this.auxJson = this.fileManager.helper.botsState;

        this._subs = [];
        this._subs.push(
            this.fileManager.watcher.botsDiscovered.subscribe(bot => {
                this.refreshAuxJson();
            })
        );
        this._subs.push(
            this.fileManager.watcher.botsRemoved.subscribe(bot => {
                this.refreshAuxJson();
            })
        );
        this._subs.push(
            this.fileManager.watcher.botsUpdated.subscribe(bot => {
                this.refreshAuxJson();
            })
        );
    }

    download() {
        this.app.download();
    }

    upload() {
        this.app.upload();
    }

    refreshAuxJson() {
        if (this.search) {
            this.auxJson = this._search();
        } else {
            this.auxJson = this.fileManager.helper.botsState;
        }
    }

    @Watch('search')
    searchChanged(val: string) {
        this.refreshAuxJson();
    }

    @Watch('includeDestroyed')
    includeDestroyedChanged() {
        this.refreshAuxJson();
    }

    beforeDestroy() {
        if (this._subs) {
            this._subs.forEach(sub => sub.unsubscribe());
            this._subs = [];
        }
    }

    private _search() {
        const value = searchFileState(
            this.search,
            this.fileManager.helper.botsState
        );
        return value;
    }
}
