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
    LoginUIStatus,
} from '@casual-simulation/aux-vm';
import { Prop, Watch } from 'vue-property-decorator';
import CheckAddressDialog from '../CheckAddressDialog/CheckAddressDialog';
import EnterAddressDialog from '../EnterAddressDialog/EnterAddressDialog';
import HasAccountDialog from '../HasAccountDialog/HasAccountDialog';
import UpdatePasswordLinkDialog from '../UpdatePasswordLinkDialog/UpdatePasswordLinkDialog';
import EnterAccountInfoDialog from '../EnterAccountInfoDialog/EnterAccountInfoDialog';
import HandleLoginMetadata from '../HandleLoginMetadata/HandleLoginMetadata';

@Component({
    components: {
        'enter-address-dialog': EnterAddressDialog,
        'check-address-dialog': CheckAddressDialog,
        'has-account-dialog': HasAccountDialog,
        'enter-account-info-dialog': EnterAccountInfoDialog,
        'update-password-link-dialog': UpdatePasswordLinkDialog,
        'handle-login-metadata': HandleLoginMetadata,
    },
})
export default class LoginEndpointUI extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    loginUIStatus: LoginUIStatus = null;

    get page() {
        return this.loginUIStatus?.page;
    }

    @Watch('endpoint')
    onEndpointChanged() {
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this._registerSubs();
    }

    created() {
        console.log('load endpoint', this.endpoint);
        this.loginUIStatus = null;
        this._sub = new Subscription();
        this._endpoint = appManager.authCoordinator.authEndpoints.get(
            this.endpoint
        );
        this._registerSubs();
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    closeDialog() {
        this.loginUIStatus = null;
        this.$emit('close');
    }

    private _registerSubs() {
        if (this._sub) {
            this._sub.unsubscribe();
        }

        this._sub = new Subscription();

        this._sub.add(
            this._endpoint.loginUIStatus.subscribe((status) => {
                this._handleLoginStatus(status);
            })
        );
    }

    private _handleLoginStatus(status: LoginUIStatus) {
        console.log('[LoginUI] Got login page', status.page);
        this.loginUIStatus = status;
    }
}
