import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../../shared/AppManager';
import { Prop, Watch } from 'vue-property-decorator';
import App from '../App/App';
import { SubscriptionLike } from 'rxjs';
import { TreeView } from 'vue-json-tree-view';
import { calculateFormulaValue, createCalculationContext } from '@yeti-cgi/aux-common';
import { values } from 'lodash';

@Component({
    components: {
        'tree-view': TreeView
    }
})
export default class AuxDebug extends Vue {

    auxJson: any = null;
    includeDestroyed: boolean = false;
    search: string = '';
    error: string;
    
    private _subs: SubscriptionLike[];

    get fileManager() {
        return appManager.fileManager;
    }

    get app() {
        return <App>this.$parent.$parent;
    }

    constructor() {
        super();
        this.auxJson = null;
        this.search = '';
        this.error = null;
        this.includeDestroyed = false;
    }

    created() {
        this.auxJson = this.fileManager.filesState;

        this._subs = [];
        this._subs.push(this.fileManager.filesDiscovered.subscribe((file) => { this.refreshAuxJson()}));
        this._subs.push(this.fileManager.filesRemoved.subscribe((file) => { this.refreshAuxJson()}));
        this._subs.push(this.fileManager.filesUpdated.subscribe((file) => { this.refreshAuxJson()}));
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
            this.auxJson = this.fileManager.filesState;
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
        const context = this.includeDestroyed ? createCalculationContext(values(this.fileManager.filesState)) : this.fileManager.createContext();
        const value = calculateFormulaValue(context, this.search);
        return value;
    }
}