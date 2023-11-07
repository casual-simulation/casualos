import { authManager } from '../../shared';
import { DateTime } from 'luxon';
import Vue from 'vue';
import Component from 'vue-class-component';
import UpdatePasswordDialog from '../UpdatePasswordDialog/UpdatePasswordDialog';

@Component({
    components: {
        'update-password-dialog': UpdatePasswordDialog,
    },
})
export default class PrivoRegistrationDialog extends Vue {
    email: string = '';
    acceptedTerms: boolean = false;
    name: string = '';
    displayName: string = '';
    dateOfBirth: Date = null;
    parentEmail: string = null;
    updatePasswordUrl: string = '';

    showEmailError: boolean = false;
    showNameError: boolean = false;
    showDateOfBirthError: boolean = false;
    showEnterAddressError: boolean = false;
    showInvalidAddressError: boolean = false;
    showTermsOfServiceError: boolean = false;
    showBannedUserError: boolean = false;
    showDisplayNameError: boolean = false;
    showParentEmailError: boolean = false;
    showInvalidParentEmailError: boolean = false;
    showEnterParentEmailError: boolean = false;

    processing: boolean = false;

    get emailFieldClass() {
        return this.showEmailError ||
            this.showEnterAddressError ||
            this.showInvalidAddressError ||
            this.showBannedUserError
            ? 'md-invalid'
            : '';
    }

    get dateOfBirthFieldClass() {
        return this.showDateOfBirthError ? 'md-invalid' : '';
    }

    get nameFieldClass() {
        return this.showNameError ? 'md-invalid' : '';
    }

    get displayNameFieldClass() {
        return this.showDisplayNameError ? 'md-invalid' : '';
    }

    get parentEmailFieldClass() {
        return this.showParentEmailError ||
            this.showEnterParentEmailError ||
            this.showInvalidParentEmailError
            ? 'md-invalid'
            : '';
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
        if (this.email) {
            let isValid = await authManager.validateEmail(this.email);
            this.showEmailError = !isValid;
        }
    }

    async checkDisplayName() {
        if (this.displayName) {
            let result = await authManager.isValidDisplayName(this.displayName);
            this.showDisplayNameError = !result.success || !result.allowed;
        }
    }

    resetErrors() {
        this.showEmailError = false;
        this.showNameError = false;
        this.showDateOfBirthError = false;
        this.showEnterAddressError = false;
        this.showInvalidAddressError = false;
        this.showTermsOfServiceError = false;
        this.showBannedUserError = false;
        this.showDisplayNameError = false;
        this.showParentEmailError = false;
        this.showInvalidParentEmailError = false;
        this.showEnterParentEmailError = false;
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

            this.email = this.email.trim();
            if (!this.email) {
                this.showEnterAddressError = true;
                return;
            }
            if (!(await authManager.validateEmail(this.email))) {
                this.showEmailError = true;
                return;
            }

            this.displayName = this.displayName.trim();
            if (!this.displayName) {
                this.showDisplayNameError = true;
                return;
            }
            const displayNameResult = await authManager.isValidDisplayName(
                this.displayName
            );
            if (!displayNameResult.success || displayNameResult.allowed) {
                this.showDisplayNameError = true;
                return;
            }
            this.name = this.name.trim();
            if (!this.name) {
                this.showNameError = true;
                return;
            }
            if (!this.dateOfBirth) {
                this.showDateOfBirthError = true;
                return;
            }
            const dob = DateTime.fromJSDate(this.dateOfBirth);
            if (dob > DateTime.now()) {
                this.showDateOfBirthError = true;
                return;
            }

            if (Math.abs(dob.diffNow('years').as('years')) < 18) {
                if (!this.parentEmail) {
                    this.showEnterParentEmailError = true;
                    return;
                }
            } else {
                if (!this.acceptedTerms) {
                    this.showTermsOfServiceError = true;
                    return;
                }
            }

            this.parentEmail = this.parentEmail?.trim();
            if (this.parentEmail) {
                if (!(await authManager.validateEmail(this.parentEmail))) {
                    this.showInvalidParentEmailError = true;
                    return;
                }
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
            }
        } finally {
            this.processing = false;
        }
    }
}
