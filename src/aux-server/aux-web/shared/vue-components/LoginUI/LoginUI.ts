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
import LoginEndpointUI from '../LoginEndpointUI/LoginEndpointUI';

@Component({
    components: {
        'login-endpoint': LoginEndpointUI,
    },
})
export default class LoginUI extends Vue {
    private _sub: Subscription;
    private _endpointSubs: Map<AuthHelperInterface, Subscription>;
    private _endpointUIs: Map<AuthHelperInterface, LoginUIStatus>;
    private _visible: boolean;

    endpoints: string[] = [];

    created() {
        this._sub = new Subscription();
        this._endpointSubs = new Map();
        this._endpointUIs = new Map();
        this.endpoints = [];

        appManager.init().then(() => {
            appManager.auth.setUseCustomUI(true);
        });

        this._sub.add(
            appManager.authCoordinator.onAuthEndpointDiscovered.subscribe(
                ({ endpoint, helper }) => {
                    this._addEndpoint(endpoint, helper);
                }
            )
        );
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    onClose(endpoint: string) {
        const helper = appManager.authCoordinator.authEndpoints.get(endpoint);
        if (helper) {
            this._endpointUIs.set(helper, {
                page: false,
            });
            this._calculateVisibility();
        }
    }

    private _addEndpoint(endpoint: string, helper: AuthHelperInterface) {
        const sub = new Subscription();
        this._endpointSubs.set(helper, sub);
        this.endpoints = [...this.endpoints, endpoint];

        sub.add(
            helper.loginUIStatus.subscribe((status) => {
                this._endpointUIs.set(helper, status);
                this._calculateVisibility();
            })
        );

        this._sub.add(sub);
    }

    private _calculateVisibility() {
        const wasVisible = this._visible;
        this._visible = [...this._endpointUIs.values()].some(
            (ui) => ui.page !== false
        );

        if (wasVisible && !this._visible) {
            this.$emit('hidden');
        } else if (!wasVisible && this._visible) {
            this.$emit('visible');
        }
    }
}
