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
import {
    ADDRESS_FIELD,
    CompleteWebAuthnLoginResult,
    FormError,
    RequestWebAuthnLoginResult,
    getFormErrors,
} from '@casual-simulation/aux-records';
import { Prop, Watch } from 'vue-property-decorator';
import FieldErrors from '../FieldErrors/FieldErrors';
import {
    browserSupportsWebAuthnAutofill,
    startAuthentication,
    WebAuthnAbortService,
} from '@simplewebauthn/browser';
import { AuthenticationResponseJSON } from '@simplewebauthn/types';
import Bowser from 'bowser';

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

    showEnterAddress: boolean = false;
    address: string = '';
    supportsConditionalUi: boolean = false;
    processingKind: 'webauthn' | 'login' = 'login';

    get emailFieldHint() {
        if (this.status.supportsSms) {
            return 'Email or Phone Number';
        } else {
            return 'Email';
        }
    }

    get isPrivoCertified() {
        return appManager.config.requirePrivoLogin;
    }

    get supportsSms() {
        return !!this.status.supportsSms;
    }

    get supportsWebAuthn() {
        return !!this.status.supportsWebAuthn && !this.supportsConditionalUi;
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

    get codeOfConductUrl() {
        return this.status.codeOfConductUrl;
    }

    get formErrors() {
        return [...(this.status.errors ?? []), ...this.extraErrors];
    }

    extraErrors: FormError[] = [];
    acceptedTerms: boolean = false;
    processing: boolean = false;

    private _apiEndpoint: string;

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
        this.extraErrors = [];
        this.address = '';
        this.acceptedTerms = false;
        this.processing = false;
        this.showEnterAddress = true;
        this.processingKind = 'login';
    }

    async mounted() {
        if (this.status.supportsWebAuthn) {
            this._apiEndpoint = await this._endpoint.getRecordsOrigin();
            const browserInfo = Bowser.getParser(navigator.userAgent);
            const isSafari = browserInfo.isBrowser('safari', true);
            if (!isSafari && (await browserSupportsWebAuthnAutofill())) {
                console.log(
                    '[EnterAddressDialog] Browser supports WebAuthn autofill.'
                );
                this.supportsConditionalUi = true;
                await this.webAuthnLogin(true);
            } else if (isSafari) {
                this.supportsConditionalUi = false;
                console.log(
                    '[EnterAddressDialog] Safari detected, not using WebAuthn autofill'
                );
            }
        }
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
            WebAuthnAbortService.cancelCeremony();
            this._endpoint.cancelLogin();
        }
        this.showEnterAddress = false;
        this.$emit('close');
    }

    async login() {
        this.processing = true;
        this.processingKind = 'login';
        WebAuthnAbortService.cancelCeremony();
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

    async webAuthnLogin(useBrowserAutofill: boolean = false) {
        this.processing = !useBrowserAutofill;
        this.processingKind = 'webauthn';
        try {
            const result = await this.loginWithWebAuthn(useBrowserAutofill);
            if (result.success === true) {
                await this._endpoint.provideLoginResult(result);
                console.log('Success!');
            } else {
                if (result.errorCode === 'aborted') {
                } else if (result.errorCode === 'invalid_origin') {
                    console.error(
                        '[EnterAddressDialog] Unable to use WebAuthn:',
                        result
                    );
                } else {
                    this.extraErrors = getFormErrors(result as any);
                }
            }
        } finally {
            this.processing = false;
        }
    }

    async loginWithWebAuthn(useBrowserAutofill: boolean = false) {
        const optionsResult = await this.getWebAuthnLoginOptions();
        if (optionsResult.success === true) {
            try {
                const response = await startAuthentication(
                    optionsResult.options,
                    useBrowserAutofill
                );
                const result = await this.completeWebAuthnLogin(
                    optionsResult.requestId,
                    response
                );

                return result;
            } catch (err) {
                if (err.name === 'AbortError') {
                    return {
                        success: false as const,
                        errorCode: 'aborted' as const,
                        errorMessage: 'The operation was aborted.',
                    };
                }
                console.error(
                    '[AuthManager] Error while logging in with WebAuthn:',
                    err
                );
                return {
                    success: false as const,
                    errorCode: 'server_error' as const,
                    errorMessage: err.message,
                };
            }
        }
        return optionsResult;
    }

    async getWebAuthnLoginOptions(): Promise<RequestWebAuthnLoginResult> {
        const response = await fetch(
            `${this._apiEndpoint}/api/v2/webauthn/login/options`,
            {}
        );

        const json = await response.text();
        return JSON.parse(json);
    }

    async completeWebAuthnLogin(
        requestId: string,
        r: AuthenticationResponseJSON
    ): Promise<CompleteWebAuthnLoginResult> {
        const response = await fetch(
            `${this._apiEndpoint}/api/v2/webauthn/login`,
            {
                body: JSON.stringify({
                    requestId,
                    response: r,
                }),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        const json = await response.text();
        return JSON.parse(json);
    }
}
