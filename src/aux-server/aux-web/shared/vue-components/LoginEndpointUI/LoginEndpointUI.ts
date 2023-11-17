import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import { AuthHelperInterface, LoginUIStatus } from '@casual-simulation/aux-vm';
import { Prop, Watch } from 'vue-property-decorator';
import CheckAddressDialog from '../CheckAddressDialog/CheckAddressDialog';
import EnterAddressDialog from '../EnterAddressDialog/EnterAddressDialog';
import HasAccountDialog from '../HasAccountDialog/HasAccountDialog';
import UpdatePasswordLinkDialog from '../UpdatePasswordLinkDialog/UpdatePasswordLinkDialog';

@Component({
    components: {
        'check-address-dialog': CheckAddressDialog,
        'enter-address-dialog': EnterAddressDialog,
        'has-account-dialog': HasAccountDialog,
        'update-password-link-dialog': UpdatePasswordLinkDialog,
    },
})
export default class LoginUI extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    loginUIStatus: LoginUIStatus = null;

    get page() {
        return this.loginUIStatus?.page;
    }

    @Watch('endpoint')
    onEndpointChanged() {
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this._registerSubs();
    }

    created() {
        this.loginUIStatus = null;
        this._sub = new Subscription();
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    private _registerSubs() {
        if (this._sub) {
            this._sub.unsubscribe();
        }

        this._sub = new Subscription();

        this._sub.add(
            this._endpoint.loginUIStatus.subscribe((status) => {
                this._handleLoginStatus(status);
            })
        );
    }

    private _handleLoginStatus(status: LoginUIStatus) {
        this.loginUIStatus = status;
    }
}
