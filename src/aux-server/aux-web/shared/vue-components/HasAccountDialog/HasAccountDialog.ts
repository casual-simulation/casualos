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
    LoginUIHasAccount,
} from '@casual-simulation/aux-vm';
import { Prop, Watch } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class HasAccountDialog extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    @Prop()
    status: LoginUIHasAccount;

    showHasAccount: boolean = false;
    hasAccountValue: boolean = null;

    get privacyPolicyUrl() {
        return this.status.privacyPolicyUrl;
    }

    get codeOfConductUrl() {
        return this.status.codeOfConductUrl;
    }

    get termsOfServiceUrl() {
        return this.status.termsOfServiceUrl;
    }

    get supportUrl() {
        return this.status.supportUrl;
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
        this.hasAccountValue = null;
        this.processing = false;
        this.showHasAccount = true;
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

    hasAccount(hasAccount: boolean) {
        this.processing = true;
        this.hasAccountValue = hasAccount;
        this._endpoint.provideHasAccount(hasAccount);
    }

    cancelHasAccount() {
        if (!this.processing) {
            this._endpoint.cancelLogin();
        }
        this.showHasAccount = false;
        this.$emit('close');
    }
}
