/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import {
    cleanPhoneNumber,
    mightBeEmailAddress,
} from '@casual-simulation/aux-common';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import type { CompleteOpenIDLoginSuccess } from '@casual-simulation/aux-records';
import type { FormError } from '@casual-simulation/aux-common';
import { getFormErrors } from '@casual-simulation/aux-common';
import HasAccountCard from '../HasAccountCard/HasAccountCard';
import {
    browserSupportsWebAuthnAutofill,
    startAuthentication,
} from '@simplewebauthn/browser';
import FieldErrors from '../../../shared/vue-components/FieldErrors/FieldErrors';

declare let ENABLE_SMS_AUTHENTICATION: boolean;

@Component({
    components: {
        'has-account-card': HasAccountCard,
        'field-errors': FieldErrors,
    },
})
export default class AuthLogin extends Vue {
    address: string = '';
    processing: boolean = false;

    acceptedTerms: boolean = false;
    showTermsOfServiceError: boolean = false;
    showEmailError: boolean = false;
    showSmsError: boolean = false;
    showInvalidAddressError: boolean = false;
    showEnterAddressError: boolean = false;
    showBannedUserError: boolean = false;
    supportsSms: boolean = false;

    errors: FormError[] = [];

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

    get usePrivoLogin() {
        return authManager.usePrivoLogin;
    }

    async created() {
        this.address = authManager.savedEmail || '';
        this.acceptedTerms = authManager.hasAcceptedTerms;
        this.processing = false;
        this._loggedIn = false;
        this.supportsSms = ENABLE_SMS_AUTHENTICATION === true;
        this.errors = [];
    }

    async mounted() {
        if (authManager.isLoggedIn()) {
            this._loggedIn = true;
        }

        await this._loadInfoAndNavigate();
    }

    hasAccount(hasAccount: boolean) {
        if (hasAccount) {
            this._loginWithPrivo();
        } else {
            this.$router.push({
                name: 'sign-up',
            });
        }
    }

    private async _loginWithPrivo() {
        const result = await authManager.loginWithPrivo();
        if (result.success) {
            const requestId = result.requestId;
            const newTab = window.open(result.authorizationUrl, '_blank');

            const codes: CompleteOpenIDLoginSuccess =
                await new Promise<CompleteOpenIDLoginSuccess>(
                    (resolve, reject) => {
                        let intervalId: number | NodeJS.Timeout;
                        const handleClose = async () => {
                            if (intervalId) {
                                clearInterval(intervalId);
                            }

                            const loginResult =
                                await authManager.completeOAuthLogin(requestId);

                            if (loginResult.success === true) {
                                resolve(loginResult);
                            } else {
                                if (loginResult.errorCode === 'not_completed') {
                                    reject(new Error('Login canceled.'));
                                } else {
                                    reject(new Error('Login failed.'));
                                }
                            }
                        };

                        intervalId = setInterval(() => {
                            if (newTab.closed) {
                                console.error('Closed!');
                                handleClose();
                            }
                        }, 500);
                    }
                );

            await authManager.loadUserInfo();

            return authManager.userId;
        }
        return null;
    }

    private async _loadInfoAndNavigate() {
        if (this._loggedIn) {
            await authManager.loadUserInfo();

            if (this.after) {
                this.$router.push({ name: this.after });
            } else {
                this.$router.push({ name: 'home' });
            }
        } else if (authManager.usePrivoLogin) {
            /* empty */
        } else if (await browserSupportsWebAuthnAutofill()) {
            const result = await authManager.loginWithWebAuthn(true);
            if (result.success === true) {
                await authManager.loadUserInfo();
                if (this.after) {
                    this.$router.push({ name: this.after });
                } else {
                    this.$router.push({ name: 'home' });
                }
            } else {
                console.error(
                    '[AuthLogin] Could not login with WebAuthn:',
                    result
                );
                this.errors = getFormErrors(result);
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
        this.processing = true;
        try {
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
            this.showBannedUserError = false;
            this.showEmailError = false;
            this.showEmailError = false;

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
                if (result.errorCode === 'unacceptable_address') {
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
                this.showSmsError = true;
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
                if (result.errorCode === 'unacceptable_address') {
                    this.showSmsError = true;
                } else if (result.errorCode === 'address_type_not_supported') {
                    this.showEnterAddressError = true;
                } else if (result.errorCode === 'user_is_banned') {
                    this.showBannedUserError = true;
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
