import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import {
    Bot,
    hasValue,
    mightBeEmailAddress,
    toast,
} from '@casual-simulation/aux-common';
import { Subscription } from 'rxjs';
import { appManager } from '../../../shared/AppManager';
import { LoginStatus, PrivoSignUpInfo } from '@casual-simulation/aux-vm';
import { DateTime } from 'luxon';
import {
    DATE_OF_BIRTH_FIELD,
    EMAIL_FIELD,
    FormError,
    PARENT_EMAIL_FIELD,
} from '@casual-simulation/aux-records';
import FieldErrors from '../FieldErrors/FieldErrors';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class RegisterDialog extends Vue {
    private _sub: Subscription;

    @Prop({ required: true })
    termsOfServiceUrl: string;

    @Prop()
    privacyPolicyUrl: string;

    @Prop()
    loginSiteName: string;

    @Prop()
    errors: FormError[];

    @Prop()
    processing: boolean;

    email: string = '';
    acceptedTerms: boolean = false;
    name: string = '';
    displayName: string = '';
    dateOfBirth: Date = null;
    parentEmail: string = null;

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
        const hasNameError = this.errors.some((e) => e.for === 'name');
        return hasNameError ? 'md-invalid' : '';
    }

    get displayNameFieldClass() {
        const hasDisplayNameError = this.errors.some(
            (e) => e.for === DATE_OF_BIRTH_FIELD
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

    get showEmail() {
        return !!this.dateOfBirth;
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

    constructor() {
        super();
    }

    checkDisplayName() {
        this.$emit('checkDisplayName', this.displayName);
    }

    checkEmail() {
        this.$emit('checkEmail', this.email);
    }

    cancelRegistration() {
        this.$emit('cancel');
    }

    async register() {
        this.displayName = this.displayName.trim();
        this.name = this.name.trim();
        this.email = this.email.trim();
        this.parentEmail = this.parentEmail?.trim();

        const info: PrivoSignUpInfo = {
            acceptedTermsOfService: this.acceptedTerms,
            email: this.email,
            name: this.name,
            dateOfBirth: this.dateOfBirth,
            displayName: this.displayName,
            parentEmail: this.parentEmail,
        };

        this.$emit('register', info);
    }
}
