import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';

@Component({
    components: {},
})
export default class AuthLogin extends Vue {
    code: string = '';
    processing: boolean = false;

    showCodeError: boolean = false;
    showInvalidCodeError: boolean = false;

    @Prop({ default: null }) after: string;
    @Prop({ default: null }) userId: string;
    @Prop({ default: null }) requestId: string;
    @Prop() address: string;
    @Prop({ default: 'email' }) addressTypeToCheck: 'email' | 'phone';

    get codeFieldClass() {
        return this.showCodeError || this.showInvalidCodeError
            ? 'md-invalid'
            : '';
    }

    get checkAddressTitle() {
        return `Check your ${
            this.addressTypeToCheck === 'phone' ? 'phone' : 'email'
        }`;
    }

    async created() {
        this.code = '';
        this.processing = false;
    }

    async mounted() {
        await this._checkLoginStatus();
    }

    async sendCode() {
        try {
            this.processing = true;
            this.showCodeError = false;
            this.showInvalidCodeError = false;
            const code = this.code?.trim();

            if (!code) {
                this.showCodeError = true;
                return;
            } else {
                const result = await authManager.completeLogin(
                    this.userId,
                    this.requestId,
                    code
                );

                if (result.success) {
                    this._checkLoginStatus();
                } else if (result.success === false) {
                    if (result.errorCode === 'invalid_code') {
                        this.showInvalidCodeError = true;
                    } else if (result.errorCode === 'invalid_request') {
                        this.cancelLogin();
                    }
                    return;
                }
            }
        } finally {
            this.processing = false;
        }
    }

    cancelLogin() {
        this.$router.push({
            name: 'login',
            query: {
                after: this.after,
            },
        });
    }

    private async _loadInfoAndNavigate() {
        await authManager.loadUserInfo();

        if (this.after) {
            this.$router.push({ name: this.after });
        } else {
            this.$router.push({ name: 'home' });
        }
    }

    private async _checkLoginStatus() {
        if (authManager.isLoggedIn()) {
            await this._loadInfoAndNavigate();
            return true;
        }

        return false;
    }
}
