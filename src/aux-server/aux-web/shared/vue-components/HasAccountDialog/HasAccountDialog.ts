import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import {
    AuthHelperInterface,
    LoginUIHasAccount,
} from '@casual-simulation/aux-vm';
import { Prop, Watch } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class HasAccountDialog extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    @Prop()
    status: LoginUIHasAccount;

    showHasAccount: boolean = false;
    hasAccountValue: boolean = null;

    get privacyPolicyUrl() {
        return this.status.privacyPolicyUrl;
    }

    processing: boolean = false;

    @Watch('status')
    onStatusChanged() {
        this.processing = false;
    }

    @Watch('endpoint')
    onEndpointChanged() {
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this._registerSubs();
    }

    created() {
        this._sub = new Subscription();
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this.hasAccountValue = null;
        this.processing = false;
        this.showHasAccount = true;
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    private _registerSubs() {
        if (this._sub) {
            this._sub.unsubscribe();
        }

        this._sub = new Subscription();
    }

    hasAccount(hasAccount: boolean) {
        this.processing = true;
        this.hasAccountValue = hasAccount;
        this._endpoint.provideHasAccount(hasAccount);
    }

    cancelHasAccount() {
        if (!this.processing) {
            this._endpoint.cancelLogin();
        }
        this.showHasAccount = false;
    }
}
