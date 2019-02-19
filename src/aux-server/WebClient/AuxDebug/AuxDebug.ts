import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../AppManager';
import { Prop, Watch,  } from 'vue-property-decorator';
import { FilesState } from '../../common/Files';
import App from '../App/App';
import { EventBus } from '../EventBus/EventBus';
import { SubscriptionLike } from 'rxjs';

@Component
export default class AuxDebug extends Vue {

    auxJson: string = null;
    
    private _subs: SubscriptionLike[];

    get fileManager() {
        return appManager.fileManager;
    }

    get app() {
        return <App>this.$parent.$parent;
    }

    constructor() {
        super();
    }

    created() {
        this.auxJson = JSON.stringify(this.fileManager.filesState, null, 2);

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
        this.auxJson = JSON.stringify(this.fileManager.filesState, null, 2);
    }

    beforeDestroy() {
      if (this._subs) {
        this._subs.forEach(sub => sub.unsubscribe());
        this._subs = [];
      }
    }
}