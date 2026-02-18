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
import type { FormError } from '@casual-simulation/aux-common';
import { getFormErrors } from '@casual-simulation/aux-common';
import FieldErrors from '../../../shared/vue-components/FieldErrors/FieldErrors';
import { redirectAfterLogin } from '../AuthRedirectHelpers';

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
        redirectAfterLogin(this.$router, this.after);
    }
}
