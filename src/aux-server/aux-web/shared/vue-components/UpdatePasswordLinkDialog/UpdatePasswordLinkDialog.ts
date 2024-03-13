import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import {
    AuthHelperInterface,
    LoginUIUpdatePasswordLink,
} from '@casual-simulation/aux-vm';
import { Prop, Watch } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class UpdatePasswordLinkDialog extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    @Prop()
    status: LoginUIUpdatePasswordLink;

    showUpdatePassword: boolean = false;

    get updatePasswordUrl() {
        return this.status.updatePasswordUrl;
    }

    get providedParentEmail() {
        return this.status.providedParentEmail;
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
        this.showUpdatePassword = true;
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    onClose() {
        this.$emit('close');
    }

    private _registerSubs() {
        if (this._sub) {
            this._sub.unsubscribe();
        }

        this._sub = new Subscription();
    }
}
