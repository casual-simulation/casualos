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
import { Prop } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { redirectAfterLogin } from '../AuthRedirectHelpers';

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
                    await this._checkLoginStatus();
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

        if (browserSupportsWebAuthn()) {
            this.$router.push({
                name: 'webauthn-register',
                query: { after: this.after },
            });
            return;
        }

        redirectAfterLogin(this.$router, this.after);
    }

    private async _checkLoginStatus() {
        if (authManager.isLoggedIn()) {
            await this._loadInfoAndNavigate();
            return true;
        }

        return false;
    }
}
