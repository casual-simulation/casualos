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

    // showEmailError: boolean = false;
    // showNameError: boolean = false;
    // showDateOfBirthError: boolean = false;
    // showEnterAddressError: boolean = false;
    // showInvalidAddressError: boolean = false;
    // showTermsOfServiceError: boolean = false;
    // showBannedUserError: boolean = false;
    // showDisplayNameError: boolean = false;
    // showDisplayNameContainsNameError: boolean = false;
    // showParentEmailError: boolean = false;
    // showInvalidParentEmailError: boolean = false;
    // showEnterParentEmailError: boolean = false;

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

    created() {
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

    async register() {
        try {
            this.processing = true;
            this.resetErrors();

            this.displayName = this.displayName.trim();
            this.name = this.name.trim();
            this.email = this.email?.trim();
            this.parentEmail = this.parentEmail?.trim();

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
