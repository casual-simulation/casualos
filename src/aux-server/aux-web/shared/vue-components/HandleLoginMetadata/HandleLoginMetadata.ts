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
import type { LoginUIHandleLoginMetadata } from '@casual-simulation/aux-vm';
import { Prop } from 'vue-property-decorator';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import RegisterWebAuthnDialog from '../RegisterWebAuthnDialog/RegisterWebAuthnDialog';
import RegisterPushSubscriptionDialog from '../RegisterPushSubscriptionDialog/RegisterPushSubscriptionDialog';

@Component({
    components: {
        'register-webauthn-dialog': RegisterWebAuthnDialog,
        'register-push-subscription-dialog': RegisterPushSubscriptionDialog,
    },
})
export default class HandleLoginMetadata extends Vue {
    private _sub: Subscription;

    @Prop({ required: true })
    endpoint: string;

    @Prop()
    status: LoginUIHandleLoginMetadata;

    currentStatus: LoginUIHandleLoginMetadata = null;
    currentEndpoint: string = null;

    showRegisterWebAuthn: boolean = false;

    showRegisterPushSubscription: boolean = false;
    private _promise: Promise<any>;

    private _resolve: (val?: any) => void;
    private _reject: (err: any) => void;

    async created() {
        this._sub = new Subscription();
        this._promise = Promise.resolve();
        this.currentStatus = null;
        this.currentEndpoint = null;
        this.showRegisterWebAuthn = false;
        this.showRegisterPushSubscription = false;

        if (
            this.status.method === 'code' &&
            !this.status.metadata.hasUserAuthenticator &&
            browserSupportsWebAuthn()
        ) {
            this._promise = this._promise.then(() =>
                this._showRegisterWebAuthn()
            );
        }

        this._promise = this._promise.then(() =>
            this._showRegisterPushSubscription()
        );
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    onCloseWebAuthn() {
        this.showRegisterWebAuthn = false;
        this._resolve();
    }

    onClosePushSubscription() {
        this.showRegisterPushSubscription = false;
        this._resolve();
    }

    private async _showRegisterWebAuthn() {
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
            this.currentEndpoint = this.endpoint;
            this.currentStatus = {
                ...this.status,
            };
            this.showRegisterWebAuthn = true;
            this.showRegisterPushSubscription = false;
        });
    }

    private async _showRegisterPushSubscription() {
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
            this.currentEndpoint = this.endpoint;
            this.currentStatus = {
                ...this.status,
            };
            this.showRegisterWebAuthn = false;
            this.showRegisterPushSubscription = true;
        });
    }
}
