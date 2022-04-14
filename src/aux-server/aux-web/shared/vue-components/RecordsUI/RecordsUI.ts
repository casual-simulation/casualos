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
} from '@casual-simulation/aux-common';
import {
    CreatePublicRecordKeyResult,
    parseRecordKey,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-records';

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

    showEnterEmail: boolean = false;
    termsOfServiceUrl: string = '';
    loginSiteName: string = '';
    email: string = '';
    acceptedTerms: boolean = false;
    showCheckEmail: boolean = false;
    supportsSms: boolean = false;
    showIframe: boolean = false;
    
    showSmsError: boolean = false;
    showEmailError: boolean = false;
    showTermsOfServiceError: boolean = false;
    processing: boolean = false;

    private _requestRecordTaskId: number | string;
    private _requestRecordSimulation: BrowserSimulation;
    private _allowRecordSimulation: BrowserSimulation;
    private _currentLoginAuth: AuthHelperInterface;
    private _loginSim: BrowserSimulation;

    get emailFieldClass() {
        return this.showEmailError || this.showSmsError ? 'md-invalid' : '';
    }

    get emailFieldHint() {
        if (this.supportsSms) {
            return 'Email or Phone Number'
        } else {
            return 'Email';
        }
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
        // Test that the value ends with an @ symbol and some characters and a dot (.) and some more characters.
        const emailTest = /\@.+\.\w{2,}$/;
        if (!this.supportsSms || emailTest.test(this.email)) {
            await this._currentLoginAuth.provideEmailAddress(
                this.email,
                this.acceptedTerms
            );
        } else {
            let sms = this.email.trim().replace(/[^\d+]/g, '');

            if (!sms.startsWith('+')) {
                console.log('[RecordsUI] No country code provided. Using +1 for United States.');
                if (sms.length > 10) {
                    // for US phone numbers, 10 characters make up a country-code less phone number
                    // 3 for area code, 
                    sms = '+' + sms;
                } else if(sms.length > 7) {
                    sms = '+1' + sms;
                } else {
                    sms = '+1616' + sms;
                }
            }

            await this._currentLoginAuth.provideSmsNumber(sms, this.acceptedTerms);
        }
        this.processing = false;
    }

    cancelLogin(automaticCancel: boolean) {
        if (this._loginSim) {
            if ((!this.showIframe && !this.showCheckEmail) || !automaticCancel) {
                this._currentLoginAuth.cancelLogin();
            }
        }
    }

    hideCheckEmail() {
        this.showCheckEmail = false;
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
                if (e.page === 'enter_email') {
                    this._loginSim = sim;
                    if (!this.showEnterEmail) {
                        this.email = '';
                        this.acceptedTerms = false;
                    }
                    this.showEnterEmail = true;
                    this.showCheckEmail = false;
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
                    this.$emit('visible');
                } else if (e.page === 'check_email') {
                    this.showEnterEmail = false;
                    this.showIframe = false;
                    this.showCheckEmail = true;
                    this.$emit('visible');
                } else if(e.page === 'show_iframe') {
                    this.showEnterEmail = false;
                    this.showCheckEmail = false;
                    this.showIframe = true;
                } else {
                    this.$emit('hidden');
                    this.showCheckEmail = false;
                    this.showIframe = false;
                    this.showEnterEmail = false;
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
            const result = await sim.auth.primary.createPublicRecordKey(recordName, this.requestRecordPolicy);
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
