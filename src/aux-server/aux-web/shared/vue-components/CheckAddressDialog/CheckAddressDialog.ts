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
import { Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import type {
    AuthHelperInterface,
    LoginUICheckAddressStatus,
} from '@casual-simulation/aux-vm';
import { Prop, Watch } from 'vue-property-decorator';
import FieldErrors from '../FieldErrors/FieldErrors';
import { CODE_FIELD } from '@casual-simulation/aux-common';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class CheckAddressDialog extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    @Prop()
    status: LoginUICheckAddressStatus;

    showCheckAddress: boolean = false;
    loginCode: string = '';

    get checkAddressTitle() {
        return `Check your ${
            this.addressTypeToCheck === 'phone' ? 'phone' : 'email'
        }`;
    }

    get showCode() {
        return !!this.status.enterCode;
    }

    get addressToCheck() {
        return this.status.address;
    }

    get addressTypeToCheck() {
        return this.status.addressType;
    }

    get supportUrl() {
        return this.status.supportUrl;
    }

    get formErrors() {
        return this.status.errors ?? [];
    }

    get codeFieldClass() {
        return this.formErrors.some((e) => e.for === CODE_FIELD)
            ? 'md-invalid'
            : '';
    }

    processing: boolean = false;

    @Watch('status')
    onStatusChanged() {
        this.processing = false;
    }

    @Watch('endpoint')
    onEndpointChanged() {
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this._registerSubs();
    }

    created() {
        this._sub = new Subscription();
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this.loginCode = '';
        this.processing = false;
        this.showCheckAddress = true;
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    private _registerSubs() {
        if (this._sub) {
            this._sub.unsubscribe();
        }

        this._sub = new Subscription();
    }

    cancelCheckAddress() {
        if (!this.processing) {
            this._endpoint.cancelLogin();
        }
        this.showCheckAddress = false;
        this.$emit('close');
    }

    sendCode() {
        this.processing = true;
        this._endpoint.provideCode(this.loginCode);
    }
}
