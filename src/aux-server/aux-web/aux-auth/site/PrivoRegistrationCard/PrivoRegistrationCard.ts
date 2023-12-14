import { authManager } from '../../shared';
import { DateTime } from 'luxon';
import Vue from 'vue';
import Component from 'vue-class-component';
import UpdatePasswordCard from '../UpdatePasswordCard/UpdatePasswordCard';
import FieldErrors from '../../../shared/vue-components/FieldErrors/FieldErrors';
import {
    DATE_OF_BIRTH_FIELD,
    DISPLAY_NAME_FIELD,
    EMAIL_FIELD,
    FormError,
    NAME_FIELD,
    PARENT_EMAIL_FIELD,
    getFormErrors,
} from '@casual-simulation/aux-records';

@Component({
    components: {
        'update-password-card': UpdatePasswordCard,
        'field-errors': FieldErrors,
    },
})
export default class PrivoRegistrationCard extends Vue {
    email: string = '';
    acceptedTerms: boolean = false;
    name: string = '';
    displayName: string = '';
    dateOfBirth: Date = null;
    parentEmail: string = null;
    updatePasswordUrl: string = '';
    enterDateOfBirth: boolean = true;

    errors: FormError[] = [];

    processing: boolean = false;

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
            const dob = DateTime.fromJSDate(this.dateOfBirth);
            return Math.abs(dob.diffNow('years').years) >= 18;
        }
        return false;
    }

    get requireParentEmail() {
        if (this.dateOfBirth) {
            const dob = DateTime.fromJSDate(this.dateOfBirth);
            return Math.abs(dob.diffNow('years').years) < 18;
        }
        return false;
    }

    get requireTermsOfService() {
        if (this.dateOfBirth) {
            const dob = DateTime.fromJSDate(this.dateOfBirth);
            return Math.abs(dob.diffNow('years').years) >= 18;
        }
        return false;
    }

    get showEmail() {
        return !!this.dateOfBirth;
    }

    get dateOfBirthText() {
        if (this.dateOfBirth) {
            const dob = DateTime.fromJSDate(this.dateOfBirth);
            return dob.toLocaleString(DateTime.DATE_MED);
        }
        return '';
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
        if (!this.displayName) {
            return;
        }
        const result = await authManager.isValidDisplayName(
            this.displayName,
            this.name
        );

        const valid = !result.success || result.allowed;

        if (result.success === false) {
            this.errors = getFormErrors(result);
        } else if (valid) {
            this.errors = this.errors.filter(
                (e) => e.for !== DISPLAY_NAME_FIELD
            );
        } else {
            if (result.containsName) {
                this.errors = [
                    ...this.errors.filter((e) => e.for !== DISPLAY_NAME_FIELD),
                    {
                        for: DISPLAY_NAME_FIELD,
                        errorCode: 'invalid_display_name',
                        errorMessage:
                            'The display name cannot contain your name.',
                    },
                ];
            } else {
                this.errors = [
                    ...this.errors.filter((e) => e.for !== DISPLAY_NAME_FIELD),
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
            this.errors = [
                {
                    for: DATE_OF_BIRTH_FIELD,
                    errorCode: 'invalid_date_of_birth',
                    errorMessage: 'Please enter a valid date of birth.',
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

            if (this.errors.length > 0) {
                return;
            }

            const result = await authManager.signUpWithPrivo({
                email: this.email,
                name: this.name,
                displayName: this.displayName,
                dateOfBirth: this.dateOfBirth,
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
