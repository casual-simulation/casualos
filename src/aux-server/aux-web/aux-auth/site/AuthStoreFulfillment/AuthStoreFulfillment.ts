
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared';
import { FormError, getFormErrors } from '@casual-simulation/aux-records';
import FieldErrors from '../../../shared/vue-components/FieldErrors/FieldErrors';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class AuthStoreFulfillment extends Vue {
    @Prop({ type: String, required: true })
    sessionId: string;

    loggedIn: boolean = false;
    activated: boolean = false;
    activationKey: string = null;
    activationUrl: string = null;
    processing: boolean = false;
    errors: FormError[] = [];

    async created() {
        this.activated = false;
        this.activationKey = null;
        this.activationUrl = null;
        this.processing = false;
        this.errors = [];
        this.loggedIn = authManager.isLoggedIn();

        if (!this.loggedIn) {
            this.activatePurchase('later');
        }
    }

    async activatePurchase(activation: 'now' | 'later') {
        try {
            this.processing = true;

            const result = await authManager.client.fulfillCheckoutSession({
                sessionId: this.sessionId,
                activation,
            });

            if (result.success) {
                this.activated = true;
                this.activationKey = result.activationKey;
                this.activationUrl = result.activationUrl;
            } else {
                this.errors = getFormErrors(result);
            }
        } finally {
            this.processing = false;
        }
    }

}
