import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import {
    AuthHelperInterface,
    LoginUIAddressStatus,
} from '@casual-simulation/aux-vm';
import {
    cleanPhoneNumber,
    mightBeEmailAddress,
} from '@casual-simulation/aux-common';
import { ADDRESS_FIELD } from '@casual-simulation/aux-records';
import { Prop, Watch } from 'vue-property-decorator';
import FieldErrors from '../FieldErrors/FieldErrors';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class EnterAddressDialog extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    @Prop()
    status: LoginUIAddressStatus;

    showEnterAddress: boolean;
    address: string;

    get emailFieldHint() {
        if (this.status.supportsSms) {
            return 'Email or Phone Number';
        } else {
            return 'Email';
        }
    }

    get enterAddressErrorMessage() {
        if (this.status.supportsSms) {
            return 'Please enter an Email Address or Phone Number';
        } else {
            return 'Please enter an Email Address';
        }
    }

    get loginSiteName() {
        return this.status.siteName;
    }

    get emailFieldClass() {
        return this.formErrors.some((e) => e.for === ADDRESS_FIELD)
            ? 'md-invalid'
            : '';
    }

    get termsOfServiceUrl() {
        return this.status.termsOfServiceUrl;
    }

    get privacyPolicyUrl() {
        return this.status.privacyPolicyUrl;
    }

    get formErrors() {
        return this.status.errors ?? [];
    }

    acceptedTerms: boolean = false;
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
        this.address = '';
        this.acceptedTerms = false;
        this.processing = false;
        this.showEnterAddress = true;
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

    cancelLogin() {
        if (!this.processing) {
            this._endpoint.cancelLogin();
        }
        this.showEnterAddress = false;
    }

    async login() {
        this.processing = true;
        if (!this.status.supportsSms || mightBeEmailAddress(this.address)) {
            await this._endpoint.provideEmailAddress(
                this.address,
                this.acceptedTerms
            );
        } else {
            const sms = cleanPhoneNumber(this.address);
            await this._endpoint.provideSmsNumber(sms, this.acceptedTerms);
        }
    }
}
