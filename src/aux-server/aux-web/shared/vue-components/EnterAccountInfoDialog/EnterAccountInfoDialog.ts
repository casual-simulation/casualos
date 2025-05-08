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
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import {
    Bot,
    hasValue,
    mightBeEmailAddress,
    toast,
} from '@casual-simulation/aux-common';
import { Subscription } from 'rxjs';
import { appManager } from '../../../shared/AppManager';
import type {
    AuthHelperInterface,
    LoginUIPrivoSignUp,
    PrivoSignUpInfo,
} from '@casual-simulation/aux-vm';
import { LoginStatus } from '@casual-simulation/aux-vm';
import { DateTime } from 'luxon';
import type { FormError } from '@casual-simulation/aux-common';
import {
    DATE_OF_BIRTH_FIELD,
    DISPLAY_NAME_FIELD,
    EMAIL_FIELD,
    NAME_FIELD,
    PARENT_EMAIL_FIELD,
    getFormErrors,
} from '@casual-simulation/aux-common';
import FieldErrors from '../FieldErrors/FieldErrors';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class EnterAccountInfoDialog extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    @Prop({ required: true })
    status: LoginUIPrivoSignUp;

    enterDateOfBirth: boolean = true;

    get termsOfServiceUrl(): string {
        return this.status.termsOfServiceUrl;
    }

    get privacyPolicyUrl(): string {
        return this.status.privacyPolicyUrl;
    }

    get codeOfConductUrl(): string {
        return this.status.codeOfConductUrl;
    }

    get supportUrl() {
        return this.status.supportUrl;
    }

    get loginSiteName(): string {
        return this.status.siteName;
    }

    showEnterAccountInfo: boolean = false;
    email: string = '';
    acceptedTerms: boolean = false;
    name: string = '';
    displayName: string = '';
    dateOfBirth: string = null;
    parentEmail: string = null;
    processing: boolean = false;
    errors: FormError[] = [];

    get emailFieldClass() {
        const hasEmailError = this.errors.some((e) => e.for === EMAIL_FIELD);
        return hasEmailError ? 'md-invalid' : '';
    }

    get dateOfBirthFieldClass() {
        const hasDOBError = this.errors.some(
            (e) => e.for === DATE_OF_BIRTH_FIELD
        );
        return hasDOBError ? 'md-invalid' : '';
    }

    get nameFieldClass() {
        const hasNameError = this.errors.some((e) => e.for === NAME_FIELD);
        return hasNameError ? 'md-invalid' : '';
    }

    get displayNameFieldClass() {
        const hasDisplayNameError = this.errors.some(
            (e) => e.for === DISPLAY_NAME_FIELD
        );
        return hasDisplayNameError ? 'md-invalid' : '';
    }

    get parentEmailFieldClass() {
        const hasParentEmailError = this.errors.some(
            (e) => e.for === PARENT_EMAIL_FIELD
        );
        return hasParentEmailError ? 'md-invalid' : '';
    }

    get maxDate() {
        return DateTime.local().toFormat('yyyy-MM-dd');
    }

    get registerEmailFieldHint() {
        if (this.requireEmail) {
            return 'Email';
        } else {
            return 'Email (Optional)';
        }
    }

    get showEmail() {
        return !!this.dateOfBirth;
    }

    get requireEmail() {
        if (this.dateOfBirth) {
            const dob = DateTime.fromFormat(this.dateOfBirth, 'yyyy-MM-dd');
            return Math.abs(dob.diffNow('years').years) >= 18;
        }
        return false;
    }

    get requireParentEmail() {
        if (this.dateOfBirth) {
            const dob = DateTime.fromFormat(this.dateOfBirth, 'yyyy-MM-dd');
            return Math.abs(dob.diffNow('years').years) < 18;
        }
        return false;
    }

    get requireTermsOfService() {
        if (this.dateOfBirth) {
            const dob = DateTime.fromFormat(this.dateOfBirth, 'yyyy-MM-dd');
            return Math.abs(dob.diffNow('years').years) >= 18;
        }
        return false;
    }

    get dateOfBirthText() {
        if (this.dateOfBirth) {
            const dob = DateTime.fromFormat(this.dateOfBirth, 'yyyy-MM-dd');
            return dob.toLocaleString(DateTime.DATE_MED);
        }
        return '';
    }

    @Watch('status')
    onStatusChanged() {
        this.processing = false;
        this.errors = [...this.status.errors];
    }

    @Watch('endpoint')
    onEndpointChanged() {
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
    }

    created() {
        this._sub = new Subscription();
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this.enterDateOfBirth = true;
        this.email = '';
        this.acceptedTerms = false;
        this.name = '';
        this.displayName = '';
        this.dateOfBirth = null;
        this.parentEmail = '';
        this.processing = false;
        this.showEnterAccountInfo = true;
        this.errors = [...this.status.errors];
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    async checkDisplayName(): Promise<void> {
        if (!this.displayName || !this.name) {
            return;
        }
        const result = await this._endpoint.isValidDisplayName(
            this.displayName,
            this.name
        );

        const valid = !result.success || result.allowed;

        if (result.success === false) {
            this.errors = getFormErrors(result);
        } else if (valid) {
            this.errors = this.errors.filter(
                (e) => e.for !== DISPLAY_NAME_FIELD && e.for !== NAME_FIELD
            );
        } else {
            if (result.containsName) {
                this.errors = [
                    ...this.errors.filter(
                        (e) =>
                            e.for !== DISPLAY_NAME_FIELD && e.for !== NAME_FIELD
                    ),
                    {
                        for: DISPLAY_NAME_FIELD,
                        errorCode: 'invalid_display_name',
                        errorMessage:
                            'The display name cannot contain your name.',
                    },
                ];
            } else {
                this.errors = [
                    ...this.errors.filter(
                        (e) =>
                            e.for !== DISPLAY_NAME_FIELD && e.for !== NAME_FIELD
                    ),
                    {
                        for: DISPLAY_NAME_FIELD,
                        errorCode: 'invalid_display_name',
                        errorMessage:
                            'This display name is either not allowed or already taken.',
                    },
                ];
            }
        }
    }

    async checkEmail(): Promise<void> {
        if (!this.email) {
            return;
        }
        const result = await this._endpoint.isValidEmailAddress(this.email);

        const valid = !result.success || result.allowed;

        if (result.success === false) {
            this.errors = getFormErrors(result);
        } else if (valid) {
            this.errors = this.errors.filter((e) => e.for !== EMAIL_FIELD);
        } else {
            this.errors = [
                ...this.errors.filter((e) => e.for !== EMAIL_FIELD),
                {
                    for: EMAIL_FIELD,
                    errorCode: 'invalid_email',
                    errorMessage: 'This email is already taken.',
                },
            ];
        }
    }

    disabledDates(date: Date): boolean {
        return date > new Date();
    }

    async cancelRegistration() {
        await this._endpoint.cancelLogin();
        this.$emit('close');
    }

    async provideDateOfBirth() {
        if (!this.dateOfBirth) {
            this.errors = [
                {
                    for: DATE_OF_BIRTH_FIELD,
                    errorCode: 'invalid_date_of_birth',
                    errorMessage: 'Please enter a valid date of birth.',
                },
            ];
            return;
        }

        const dob = DateTime.fromFormat(this.dateOfBirth, 'yyyy-MM-dd');
        if (dob > DateTime.local()) {
            this.errors = [
                {
                    for: DATE_OF_BIRTH_FIELD,
                    errorCode: 'invalid_date_of_birth',
                    errorMessage: 'Please enter a date in the past.',
                },
            ];
            return;
        }

        this.errors = [];
        this.enterDateOfBirth = false;
    }

    async register() {
        try {
            this.processing = true;
            this.displayName = this.displayName.trim();
            this.name = this.name.trim();
            this.email = this.email.trim();
            this.parentEmail = this.parentEmail?.trim();

            const info: PrivoSignUpInfo = {
                acceptedTermsOfService: this.acceptedTerms,
                email: this.email,
                name: this.name,
                dateOfBirth: DateTime.fromFormat(
                    this.dateOfBirth,
                    'yyyy-MM-dd'
                ).toJSDate(),
                displayName: this.displayName,
                parentEmail: this.parentEmail,
            };

            await this._endpoint.providePrivoSignUpInfo(info);
        } catch (err) {
            this.processing = false;
            console.error(err);
        }
    }
}
