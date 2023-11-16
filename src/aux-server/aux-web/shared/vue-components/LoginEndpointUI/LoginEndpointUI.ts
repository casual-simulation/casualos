import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import {
    AuthHelperInterface,
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

@Component({
    components: {},
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
