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
import { authManager } from '../../shared';
import type { FormError } from '@casual-simulation/aux-common';
import { getFormErrors } from '@casual-simulation/aux-common';
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
