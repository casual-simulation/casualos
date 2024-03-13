import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { FormError, getFormErrors } from '@casual-simulation/aux-records';
import FieldErrors from '../../../shared/vue-components/FieldErrors/FieldErrors';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class AuthRegisterWebAuthn extends Vue {
    processing: boolean = false;

    @Prop({ default: null }) after: string;

    errors: FormError[] = [];

    async created() {
        this.processing = false;
        this.errors = [];
    }

    async mounted() {
        if (!browserSupportsWebAuthn()) {
            this._loadInfoAndNavigate();
        }
    }

    cancel() {
        this._loadInfoAndNavigate();
    }

    async addPasskey() {
        try {
            this.processing = true;
            const result = await authManager.addPasskeyWithWebAuthn();
            if (result.success) {
                console.log(
                    '[AuthRegisterWebAuthn] Successfully added passkey with WebAuthn.'
                );
                await this._loadInfoAndNavigate();
            } else {
                this.errors = getFormErrors(result);
            }
        } finally {
            this.processing = false;
        }
    }

    private async _loadInfoAndNavigate() {
        if (this.after) {
            this.$router.push({ name: this.after });
        } else {
            this.$router.push({ name: 'home' });
        }
    }
}
