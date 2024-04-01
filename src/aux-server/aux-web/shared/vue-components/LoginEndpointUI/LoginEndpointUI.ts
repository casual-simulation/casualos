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
import EnterAccountInfoDialog from '../EnterAccountInfoDialog/EnterAccountInfoDialog';
import RegisterWebAuthnDialog from '../RegisterWebAuthnDialog/RegisterWebAuthnDialog';

@Component({
    components: {
        'enter-address-dialog': EnterAddressDialog,
        'check-address-dialog': CheckAddressDialog,
        'has-account-dialog': HasAccountDialog,
        'enter-account-info-dialog': EnterAccountInfoDialog,
        'update-password-link-dialog': UpdatePasswordLinkDialog,
        'register-webauthn-dialog': RegisterWebAuthnDialog,
    },
})
export default class LoginEndpointUI extends Vue {
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
        console.log('load endpoint', this.endpoint);
        this.loginUIStatus = null;
        this._sub = new Subscription();
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this._registerSubs();
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    closeDialog() {
        this.loginUIStatus = null;
        this.$emit('close');
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
        console.log('[LoginUI] Got login page', status.page);
        this.loginUIStatus = status;
    }
}
