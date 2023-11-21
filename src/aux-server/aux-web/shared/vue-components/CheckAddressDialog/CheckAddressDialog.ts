import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import {
    AuthHelperInterface,
    LoginUICheckAddressStatus,
} from '@casual-simulation/aux-vm';
import { Prop, Watch } from 'vue-property-decorator';
import FieldErrors from '../FieldErrors/FieldErrors';
import { CODE_FIELD } from '@casual-simulation/aux-records';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class CheckAddressDialog extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    @Prop()
    status: LoginUICheckAddressStatus;

    showCheckAddress: boolean;
    loginCode: string;

    get checkAddressTitle() {
        return `Check your ${
            this.addressTypeToCheck === 'phone' ? 'phone' : 'email'
        }`;
    }

    get showCode() {
        return !!this.status.enterCode;
    }

    get addressToCheck() {
        return this.status.address;
    }

    get addressTypeToCheck() {
        return this.status.addressType;
    }

    get formErrors() {
        return this.status.errors ?? [];
    }

    get codeFieldClass() {
        return this.formErrors.some((e) => e.for === CODE_FIELD)
            ? 'md-invalid'
            : '';
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
        this.loginCode = '';
        this.processing = false;
        this.showCheckAddress = true;
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

    cancelCheckAddress() {
        if (!this.processing) {
            this._endpoint.cancelLogin();
        }
        this.showCheckAddress = false;
    }

    sendCode() {
        this.processing = true;
        this._endpoint.provideCode(this.loginCode);
    }
}
