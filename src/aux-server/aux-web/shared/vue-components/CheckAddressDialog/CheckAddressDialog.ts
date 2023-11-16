import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import {
    AuthHelperInterface,
    LoginUICheckAddressStatus,
    LoginUIStatus,
    Simulation,
} from '@casual-simulation/aux-vm';
import {
    AuthHelper,
    BrowserSimulation,
} from '@casual-simulation/aux-vm-browser';
import {
    asyncResult,
    asyncError,
    approveAction,
    APPROVED_SYMBOL,
    hasValue,
    cleanPhoneNumber,
    mightBeEmailAddress,
} from '@casual-simulation/aux-common';
import {
    RecordDataAction,
    DataRecordAction,
    GetRecordDataAction,
    EraseRecordDataAction,
    GrantInstAdminPermissionAction,
} from '@casual-simulation/aux-runtime';
import {
    CreatePublicRecordKeyResult,
    parseRecordKey,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-records';
import { AddressType } from '@casual-simulation/aux-records/AuthStore';
import { DateTime } from 'luxon';
import { Prop, Watch } from 'vue-property-decorator';
import FieldErrors from '../FieldErrors/FieldErrors';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class LoginUI extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    @Prop()
    status: LoginUICheckAddressStatus;

    showCheckAddress: boolean;
    loginCode: string;

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
        return this.status.errors;
    }

    processing: boolean = false;

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
