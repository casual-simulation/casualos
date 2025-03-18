import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import type {
    AuthHelperInterface,
    LoginUIHandleLoginMetadata,
} from '@casual-simulation/aux-vm';
import { Prop, Watch } from 'vue-property-decorator';
import type {
    CompleteWebAuthnRegistrationResult,
    FormError,
    RequestWebAuthnRegistrationResult,
} from '@casual-simulation/aux-records';
import { getFormErrors } from '@casual-simulation/aux-records';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { startRegistration } from '@simplewebauthn/browser';
import FieldErrors from '../FieldErrors/FieldErrors';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class RegisterWebAuthnDialog extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    @Prop()
    status: LoginUIHandleLoginMetadata;

    errors: FormError[] = [];
    processing: boolean = false;

    showRegisterWebAuthn: boolean = false;

    @Watch('endpoint')
    onEndpointChanged() {
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this._registerSubs();
    }

    async created() {
        this._sub = new Subscription();
        this.errors = [];
        this.processing = false;
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this.showRegisterWebAuthn = true;
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    onClose() {
        this.$emit('close');
    }

    async addPasskey() {
        try {
            this.processing = true;
            const result = await this._addPasskeyWithWebAuthn();
            if (result.success) {
                this.$emit('close');
            } else {
                this.errors = getFormErrors(result);
            }
        } finally {
            this.processing = false;
        }
    }

    private async _addPasskeyWithWebAuthn(): Promise<
        RequestWebAuthnRegistrationResult | CompleteWebAuthnRegistrationResult
    > {
        const optionsResult = await this._getWebAuthnRegistrationOptions();
        if (optionsResult.success === true) {
            try {
                const response = await startRegistration(optionsResult.options);
                const result = await this._completeWebAuthnRegistration(
                    response
                );
                return result;
            } catch (error) {
                console.error(error);
                if (error.name === 'InvalidStateError') {
                    return {
                        success: true,
                    };
                } else {
                    return {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'Error: ' + error.message,
                    };
                }
            }
        }
        return optionsResult;
    }

    private async _getWebAuthnRegistrationOptions(): Promise<RequestWebAuthnRegistrationResult> {
        const response = await fetch(
            `${this.status.apiEndpoint}/api/v2/webauthn/register/options`,
            {
                headers: this.status.authenticationHeaders,
            }
        );

        const json = await response.text();
        return JSON.parse(json);
    }

    private async _completeWebAuthnRegistration(
        r: RegistrationResponseJSON
    ): Promise<CompleteWebAuthnRegistrationResult> {
        const response = await fetch(
            `${this.status.apiEndpoint}/api/v2/webauthn/register`,
            {
                body: JSON.stringify({
                    response: r,
                }),
                method: 'POST',
                headers: {
                    ...this.status.authenticationHeaders,
                    'Content-Type': 'application/json',
                },
            }
        );

        const json = await response.text();
        return JSON.parse(json);
    }

    private _registerSubs() {
        if (this._sub) {
            this._sub.unsubscribe();
        }

        this._sub = new Subscription();
    }
}
