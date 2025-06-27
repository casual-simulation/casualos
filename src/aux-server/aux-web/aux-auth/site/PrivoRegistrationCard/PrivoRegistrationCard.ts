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
import { authManager } from '../../shared';
import { DateTime } from 'luxon';
import Vue from 'vue';
import Component from 'vue-class-component';
import UpdatePasswordCard from '../UpdatePasswordCard/UpdatePasswordCard';
import FieldErrors from '../../../shared/vue-components/FieldErrors/FieldErrors';
import type { FormError } from '@casual-simulation/aux-common';
import {
    DATE_OF_BIRTH_FIELD,
    DISPLAY_NAME_FIELD,
    EMAIL_FIELD,
    NAME_FIELD,
    PARENT_EMAIL_FIELD,
    getFormErrors,
} from '@casual-simulation/aux-common';
import DateOfBirthInput from '../../../shared/vue-components/DateOfBirthInput/DateOfBirthInput';

@Component({
    components: {
        'update-password-card': UpdatePasswordCard,
        'field-errors': FieldErrors,
        'date-of-birth-input': DateOfBirthInput,
    },
})
export default class PrivoRegistrationCard extends Vue {
    email: string = '';
    acceptedTerms: boolean = false;
    name: string = '';
    displayName: string = '';
    dateOfBirth: string = null;
    parentEmail: string = null;
    updatePasswordUrl: string = '';
    enterDateOfBirth: boolean = true;

    errors: FormError[] = [];

    processing: boolean = false;

    get supportUrl() {
        return authManager.supportUrl;
    }

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

    get registerEmailFieldHint() {
        if (this.requireEmail) {
            return 'Email';
        } else {
            return 'Email (Optional)';
        }
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

    get showEmail() {
        return !!this.dateOfBirth;
    }

    get dateOfBirthText() {
        if (this.dateOfBirth) {
            const dob = DateTime.fromFormat(this.dateOfBirth, 'yyyy-MM-dd');
            return dob.toLocaleString(DateTime.DATE_MED);
        }
        return '';
    }

    get maxDate() {
        return DateTime.local().toFormat('yyyy-MM-dd');
    }

    created() {
        this.enterDateOfBirth = true;
        this.resetFields();
        this.resetErrors();
    }

    disabledDates(date: Date) {
        return date > new Date();
    }

    goHome() {
        this.$router.push({ name: 'home' });
    }

    async checkEmail() {
        if (!this.email) {
            return;
        }
        const result = await authManager.isValidEmailAddress(this.email);

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
                    errorMessage: 'This email is not allowed.',
                },
            ];
        }
    }

    async checkDisplayName() {
        if (!this.displayName || !this.name) {
            return;
        }
        const result = await authManager.client.isDisplayNameValid({
            displayName: this.displayName,
            name: this.name,
        });

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
                        errorMessage: 'This display name is not allowed.',
                    },
                ];
            }
        }
    }

    resetErrors() {
        this.errors = [];
    }

    resetFields() {
        this.email = '';
        this.acceptedTerms = false;
        this.name = '';
        this.displayName = '';
        this.dateOfBirth = null;
        this.parentEmail = null;
    }

    async provideDateOfBirth() {
        if (!this.dateOfBirth) {
            if (
                this.$refs.dateOfBirth &&
                this.$refs.dateOfBirth instanceof DateOfBirthInput &&
                this.$refs.dateOfBirth.error
            ) {
                this.errors = [
                    {
                        for: DATE_OF_BIRTH_FIELD,
                        errorCode: 'invalid_date_of_birth',
                        errorMessage: this.$refs.dateOfBirth.error,
                    },
                ];
            } else {
                this.errors = [
                    {
                        for: DATE_OF_BIRTH_FIELD,
                        errorCode: 'invalid_date_of_birth',
                        errorMessage: 'Please enter a valid date of birth.',
                    },
                ];
                return;
            }
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
            this.resetErrors();

            this.displayName = this.displayName.trim();
            this.name = this.name.trim();
            this.email = this.email?.trim();
            this.parentEmail = this.parentEmail?.trim();

            if (!this.displayName) {
                this.errors.push({
                    for: DISPLAY_NAME_FIELD,
                    errorCode: 'invalid_display_name',
                    errorMessage: 'Please enter a display name.',
                });
            }
            if (!this.name) {
                this.errors.push({
                    for: NAME_FIELD,
                    errorCode: 'invalid_name',
                    errorMessage: 'Please enter a name.',
                });
            }

            if (this.displayName && this.name) {
                const validDisplayName =
                    await authManager.client.isDisplayNameValid({
                        displayName: this.displayName,
                        name: this.name,
                    });
                if (validDisplayName.success === false) {
                    this.errors.push(...getFormErrors(validDisplayName));
                } else if (!validDisplayName.allowed) {
                    if (validDisplayName.containsName) {
                        this.errors.push({
                            for: DISPLAY_NAME_FIELD,
                            errorCode: 'invalid_display_name',
                            errorMessage:
                                'The display name cannot contain your name.',
                        });
                    } else {
                        this.errors.push({
                            for: DISPLAY_NAME_FIELD,
                            errorCode: 'invalid_display_name',
                            errorMessage:
                                'This display name is either not allowed or already taken.',
                        });
                    }
                }
            }

            if (this.requireEmail && !this.email) {
                this.errors.push({
                    for: EMAIL_FIELD,
                    errorCode: 'invalid_email',
                    errorMessage: 'Please enter an email.',
                });
            }

            if (this.requireParentEmail && !this.parentEmail) {
                this.errors.push({
                    for: PARENT_EMAIL_FIELD,
                    errorCode: 'invalid_parent_email',
                    errorMessage: 'Please enter a parent email.',
                });
            }

            if (this.requireEmail && this.email) {
                if (!(await authManager.validateEmail(this.email))) {
                    this.errors.push({
                        for: EMAIL_FIELD,
                        errorCode: 'invalid_email',
                        errorMessage: 'This email is already taken.',
                    });
                }
            }

            if (this.requireParentEmail && this.parentEmail) {
                if (
                    !(await authManager.validateEmail(this.parentEmail, true))
                ) {
                    this.errors.push({
                        for: PARENT_EMAIL_FIELD,
                        errorCode: 'invalid_parent_email',
                        errorMessage:
                            'The provided email must be a valid email address.',
                    });
                }
            }

            if (this.errors.length > 0) {
                return;
            }

            const result = await authManager.signUpWithPrivo({
                email: this.email,
                name: this.name,
                displayName: this.displayName,
                dateOfBirth: DateTime.fromFormat(
                    this.dateOfBirth,
                    'yyyy-MM-dd'
                ).toJSDate(),
                acceptedTermsOfService: this.acceptedTerms,
                parentEmail: this.parentEmail,
            });

            if (result.success) {
                this.updatePasswordUrl = result.updatePasswordUrl;
            } else if (result.success === false) {
                this.errors = getFormErrors(result);
            }
        } finally {
            this.processing = false;
        }
    }
}
