import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../../shared/AppManager';
import { Prop, Watch } from 'vue-property-decorator';
import App from '../App/App';
import { SubscriptionLike } from 'rxjs';
import { TreeView } from 'vue-json-tree-view';
import { FilesState } from '@yeti-cgi/aux-common';

@Component({
    components: {
        'tree-view': TreeView
    }
})
export default class AuxDebug extends Vue {

    auxJson: FilesState = null;
    
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
    }

    created() {
        this.auxJson = this.fileManager.filesState;

        this._subs = [];
        this._subs.push(this.fileManager.fileDiscovered.subscribe((file) => { this.refreshAuxJson()}));
        this._subs.push(this.fileManager.fileRemoved.subscribe((file) => { this.refreshAuxJson()}));
        this._subs.push(this.fileManager.fileUpdated.subscribe((file) => { this.refreshAuxJson()}));
    }

    download() {
        this.app.download();
    }

    upload() {
        this.app.upload();
    }

    refreshAuxJson() {
        this.auxJson = this.fileManager.filesState;
    }

    beforeDestroy() {
      if (this._subs) {
        this._subs.forEach(sub => sub.unsubscribe());
        this._subs = [];
      }
    }
}