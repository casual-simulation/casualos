import {
    cleanPhoneNumber,
    mightBeEmailAddress,
} from '@casual-simulation/aux-common';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';

declare let ENABLE_SMS_AUTHENTICATION: boolean;

@Component({
    components: {},
})
export default class AuthLogin extends Vue {
    address: string;
    processing: boolean;

    acceptedTerms: boolean = false;
    showTermsOfServiceError: boolean = false;
    showEmailError: boolean = false;
    showSmsError: boolean = false;
    showInvalidAddressError: boolean = false;
    showEnterAddressError: boolean = false;
    supportsSms: boolean = false;

    @Prop({ default: null }) after: string;

    private _loggedIn: boolean;

    get addressFieldHint() {
        return this.supportsSms ? `Email or Phone Number` : `Email`;
    }

    get addressFieldClass() {
        return this.showEmailError ||
            this.showSmsError ||
            this.showEnterAddressError ||
            this.showInvalidAddressError
            ? 'md-invalid'
            : '';
    }

    get enterAddressErrorMessage() {
        if (this.supportsSms) {
            return 'Please enter an Email Address or Phone Number';
        } else {
            return 'Please enter an Email Address';
        }
    }

    async created() {
        this.address = authManager.savedEmail || '';
        this.acceptedTerms = authManager.hasAcceptedTerms;
        this.processing = false;
        this._loggedIn = false;
        this.supportsSms = ENABLE_SMS_AUTHENTICATION === true;
    }

    async mounted() {
        if (authManager.isLoggedIn()) {
            this._loggedIn = true;
        }

        await this._loadInfoAndNavigate();
    }

    private async _loadInfoAndNavigate() {
        if (this._loggedIn) {
            await authManager.loadUserInfo();

            if (this.after) {
                this.$router.push({ name: this.after });
            } else {
                this.$router.push({ name: 'home' });
            }
        }
    }

    private async _checkLoginStatus() {
        if (authManager.isLoggedIn()) {
            await this._loadInfoAndNavigate();
            return true;
        }

        return false;
    }

    @Watch('acceptedTerms')
    termsOfServiceAccepted() {
        if (this.acceptedTerms) {
            this.showTermsOfServiceError = false;
        }
    }

    async login() {
        if (await this._checkLoginStatus()) {
            return;
        }

        if (!this.acceptedTerms) {
            this.showTermsOfServiceError = true;
            return;
        }
        if (!this.address) {
            this.showEnterAddressError = true;
            return;
        }
        this.showTermsOfServiceError = false;
        this.showEnterAddressError = false;
        this.showEmailError = false;
        this.showEmailError = false;
        this.processing = true;

        try {
            if (!this.supportsSms || mightBeEmailAddress(this.address)) {
                await this._loginWithEmail();
            } else {
                const sms = cleanPhoneNumber(this.address);
                if (!sms) {
                    this.showInvalidAddressError = true;
                } else {
                    await this._loginWithPhoneNumber(sms);
                }
            }
        } finally {
            this.processing = false;
        }
    }

    private async _loginWithEmail() {
        try {
            if (!(await authManager.validateEmail(this.address))) {
                this.showEmailError = true;
                this.processing = false;
                return;
            }

            const result = await authManager.loginWithEmail(this.address);
            if (result.success) {
                this.$router.push({
                    name: 'code',
                    query: {
                        after: this.after,
                        userId: result.userId,
                        requestId: result.requestId,
                        address: this.address,
                        addressTypeToCheck: 'email',
                    },
                });
            } else if (result.success === false) {
                if (result.errorCode === 'invalid_address') {
                    this.showEmailError = true;
                } else if (result.errorCode === 'address_type_not_supported') {
                    this.showEnterAddressError = true;
                }
                return;
            }
        } catch (err) {
            console.error('[AuthLogin] Could not login with email:', err);
            this._loggedIn = false;
        }
    }

    private async _loginWithPhoneNumber(sms: string) {
        try {
            if (!(await authManager.validateSmsNumber(sms))) {
                this.showEmailError = true;
                this.processing = false;
                return;
            }

            const result = await authManager.loginWithPhoneNumber(sms);
            if (result.success) {
                this.$router.push({
                    name: 'code',
                    query: {
                        after: this.after,
                        userId: result.userId,
                        requestId: result.requestId,
                        address: sms,
                        addressTypeToCheck: 'phone',
                    },
                });
            } else if (result.success === false) {
                if (result.errorCode === 'invalid_address') {
                    this.showSmsError = true;
                } else if (result.errorCode === 'address_type_not_supported') {
                    this.showEnterAddressError = true;
                }
                return;
            }
        } catch (err) {
            console.error(
                '[AuthLogin] Could not login with phone number:',
                err
            );
            this._loggedIn = false;
        }
    }
}
