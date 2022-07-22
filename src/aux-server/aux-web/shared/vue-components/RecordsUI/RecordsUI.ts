import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import { AuthHelperInterface, Simulation } from '@casual-simulation/aux-vm';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import {
    asyncResult,
    asyncError,
    RecordDataAction,
    DataRecordAction,
    approveDataRecord,
    GetRecordDataAction,
    EraseRecordDataAction,
    APPROVED_SYMBOL,
    hasValue,
    cleanPhoneNumber,
    mightBeEmailAddress,
} from '@casual-simulation/aux-common';
import {
    CreatePublicRecordKeyResult,
    parseRecordKey,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-records';
import { AddressType } from '@casual-simulation/aux-records/AuthStore';

@Component({
    components: {},
})
export default class RecordsUI extends Vue {
    private _sub: Subscription;
    private _simulationSubs: Map<Simulation, Subscription>;

    showRequestPublicRecord: boolean = false;
    requestRecordName: string = '';
    requestRecordPolicy: PublicRecordKeyPolicy = null;

    showAllowRecordData: boolean = false;
    allowRecordName: string = '';
    allowAddress: string = '';
    completedAllowRecord: boolean = false;
    recordDataEvent: DataRecordAction = null;

    showEnterAddress: boolean = false;
    termsOfServiceUrl: string = '';
    loginSiteName: string = '';
    email: string = '';
    acceptedTerms: boolean = false;
    showCheckAddress: boolean = false;
    supportsSms: boolean = false;
    showIframe: boolean = false;
    loginCode: string = '';
    addressToCheck: string = '';
    addressTypeToCheck: AddressType = 'email';

    showSmsError: boolean = false;
    showEmailError: boolean = false;
    showEnterAddressError: boolean = false;
    showInvalidAddressError: boolean = false;
    showTermsOfServiceError: boolean = false;
    showInvalidCodeError: boolean = false;
    processing: boolean = false;

    private _requestRecordTaskId: number | string;
    private _requestRecordSimulation: BrowserSimulation;
    private _allowRecordSimulation: BrowserSimulation;
    private _currentLoginAuth: AuthHelperInterface;
    private _loginSim: BrowserSimulation;

    get emailFieldClass() {
        return this.showEmailError ||
            this.showSmsError ||
            this.showEnterAddressError ||
            this.showInvalidAddressError
            ? 'md-invalid'
            : '';
    }

    get emailFieldHint() {
        if (this.supportsSms) {
            return 'Email or Phone Number';
        } else {
            return 'Email';
        }
    }

    get enterAddressErrorMessage() {
        if (this.supportsSms) {
            return 'Please enter an Email Address or Phone Number';
        } else {
            return 'Please enter an Email Address';
        }
    }

    get checkAddressTitle() {
        return `Check your ${
            this.addressTypeToCheck === 'phone' ? 'phone' : 'email'
        }`;
    }

    get codeFieldClass() {
        return this.showInvalidCodeError ? 'md-invalid' : '';
    }

    created() {
        this._sub = new Subscription();
        this._simulationSubs = new Map();

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._simulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._simulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    async login() {
        this.processing = true;
        this.showInvalidAddressError = false;

        if (!hasValue(this.email)) {
            this.showEnterAddressError = true;
        } else {
            this.showEnterAddressError = false;
            if (!this.supportsSms || mightBeEmailAddress(this.email)) {
                await this._currentLoginAuth.provideEmailAddress(
                    this.email,
                    this.acceptedTerms
                );
            } else {
                const sms = cleanPhoneNumber(this.email);

                if (!hasValue(sms)) {
                    this.showInvalidAddressError = true;
                } else {
                    await this._currentLoginAuth.provideSmsNumber(
                        sms,
                        this.acceptedTerms
                    );
                }
            }
        }
    }

    async sendCode() {
        if (this._loginSim) {
            this.processing = true;
            await this._currentLoginAuth.provideCode(this.loginCode);
        }
    }

    cancelLogin(automaticCancel: boolean) {
        if (this._loginSim) {
            if (
                (!this.showIframe && !this.showCheckAddress) ||
                !automaticCancel
            ) {
                this._currentLoginAuth.cancelLogin();
            }
        }
    }

    hideCheckAddress(automaticCancel?: boolean) {
        if (this._loginSim && (this.showCheckAddress || automaticCancel)) {
            this._currentLoginAuth.cancelLogin();
        }
        this.showCheckAddress = false;
        this.$emit('hidden');
    }

    hideCheckSms() {
        this.showIframe = false;
        this.$emit('hidden');
    }

    allowRecordData() {
        this.completedAllowRecord = true;
        const newEvent = approveDataRecord(this.recordDataEvent);
        this._allowRecordSimulation.records.handleEvents([
            newEvent as
                | RecordDataAction
                | GetRecordDataAction
                | EraseRecordDataAction,
        ]);
        this.cancelAllowRecordData();
    }

    cancelAllowRecordData() {
        this.showAllowRecordData = false;
        if (
            this.recordDataEvent &&
            hasValue(this.recordDataEvent.taskId) &&
            !this.completedAllowRecord
        ) {
            this._allowRecordSimulation.helper.transaction(
                asyncResult(this.recordDataEvent.taskId, {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'The user denied this operation.',
                })
            );
        }
        this.recordDataEvent = null;
        this.allowAddress = '';
        this.allowRecordName = '';
        this.completedAllowRecord = false;
    }

    private _simulationAdded(sim: BrowserSimulation): void {
        let sub = new Subscription();
        this._sub.add(sub);

        sub.add(
            sim.localEvents.subscribe((e) => {
                if (e.type === 'get_public_record_key') {
                    this.showRequestPublicRecord = true;
                    this.requestRecordName = e.recordName;
                    this.requestRecordPolicy = e.policy;
                    this._requestRecordTaskId = e.taskId;
                    this._requestRecordSimulation = sim;
                    this.$emit('visible');
                } else if (e.type === 'record_data' && e.requiresApproval) {
                    this._allowRecordSimulation = sim;
                    this.showAllowRecordData = true;
                    this.completedAllowRecord = false;
                    this.recordDataEvent = e;
                    this.allowAddress = e.address;
                    let key = parseRecordKey(e.recordKey);
                    if (key) {
                        this.allowRecordName = key[0];
                    } else {
                        this.allowRecordName = 'N/A';
                    }
                } else if (e.type === 'get_record_data' && e.requiresApproval) {
                    this._allowRecordSimulation = sim;
                    this.showAllowRecordData = true;
                    this.completedAllowRecord = false;
                    this.recordDataEvent = e;
                    this.allowAddress = e.address;
                    this.allowRecordName = e.recordName;
                } else if (
                    e.type === 'erase_record_data' &&
                    e.requiresApproval
                ) {
                    this._allowRecordSimulation = sim;
                    this.showAllowRecordData = true;
                    this.completedAllowRecord = false;
                    this.recordDataEvent = e;
                    this.allowAddress = e.address;
                    let key = parseRecordKey(e.recordKey);
                    if (key) {
                        this.allowRecordName = key[0];
                    } else {
                        this.allowRecordName = 'N/A';
                    }
                }
            })
        );

        sub.add(
            sim.auth.loginUIStatus.subscribe((e) => {
                this._currentLoginAuth = sim.auth.getEndpoint(e.endpoint);
                if (e.page === 'enter_address') {
                    this._loginSim = sim;
                    if (!this.showEnterAddress) {
                        this.email = '';
                        this.acceptedTerms = false;
                    }
                    this.showEnterAddress = true;
                    this.showCheckAddress = false;
                    this.showIframe = false;
                    this.termsOfServiceUrl = e.termsOfServiceUrl;
                    this.loginSiteName = e.siteName;
                    this.showEmailError =
                        e.showEnterEmailError || e.showInvalidEmailError;
                    this.showSmsError =
                        e.showInvalidSmsError || e.showEnterSmsError;
                    this.showTermsOfServiceError =
                        e.showAcceptTermsOfServiceError;
                    this.supportsSms = e.supportsSms;
                    this.processing = false;
                    this.$emit('visible');
                } else if (e.page === 'check_address') {
                    this.showEnterAddress = false;
                    this.showIframe = false;
                    this.showCheckAddress = true;
                    this.addressToCheck = e.address;
                    this.addressTypeToCheck = e.addressType;
                    this.showInvalidCodeError = e.showInvalidCodeError;
                    this.processing = false;
                    this.$emit('visible');
                } else if (e.page === 'show_iframe') {
                    this.showEnterAddress = false;
                    this.showCheckAddress = false;
                    this.showIframe = true;
                    this.processing = false;
                } else {
                    this.$emit('hidden');
                    this.showCheckAddress = false;
                    this.showIframe = false;
                    this.showEnterAddress = false;
                    this.processing = false;
                    if (this._loginSim === sim) {
                        this._loginSim = null;
                    }
                }
            })
        );

        sim.auth.setUseCustomUI(true);
    }

    async createRecordKey(recordName: string) {
        const taskId = this._requestRecordTaskId;
        const sim = this._requestRecordSimulation;
        this._hideCreateRecordKey();

        if (taskId && sim) {
            const result = await sim.auth.primary.createPublicRecordKey(
                recordName,
                this.requestRecordPolicy
            );
            sim.helper.transaction(asyncResult(taskId, result));
        }
    }

    async cancelCreateRecordKey() {
        const taskId = this._requestRecordTaskId;
        const sim = this._requestRecordSimulation;
        this._hideCreateRecordKey();

        if (taskId && sim) {
            const result: CreatePublicRecordKeyResult = {
                success: false,
                errorCode: 'unauthorized_to_create_record_key',
                errorMessage: 'The user denied the request.',
                errorReason: 'user_denied',
            };
            sim.helper.transaction(asyncResult(taskId, result));
        }
    }

    private _hideCreateRecordKey() {
        this.showRequestPublicRecord = false;
        this.requestRecordName = '';
        this._requestRecordTaskId = null;
        this._requestRecordSimulation = null;
        this.$emit('hidden');
    }

    private _simulationRemoved(sim: Simulation): void {
        const sub = this._simulationSubs.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulationSubs.delete(sim);
    }
}
