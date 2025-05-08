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
    LoginUIHandleLoginMetadata,
} from '@casual-simulation/aux-vm';
import { Prop, Watch } from 'vue-property-decorator';
import type { FormError } from '@casual-simulation/aux-common';
import {
    SUBSCRIPTION_ID_NAMESPACE,
    getFormErrors,
} from '@casual-simulation/aux-common';

/* eslint-disable casualos/no-non-type-imports */
import { createRecordsClient } from '@casual-simulation/aux-records/RecordsClient';
import { getPushManager } from '../../PushHelpers';
import { v5 as uuidv5 } from 'uuid';
import FieldErrors from '../FieldErrors/FieldErrors';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class RegisterPushSubscriptionDialog extends Vue {
    private _sub: Subscription;
    private _endpoint: AuthHelperInterface;

    @Prop({ required: true })
    endpoint: string;

    @Prop()
    status: LoginUIHandleLoginMetadata;

    errors: FormError[] = [];
    processing: boolean = false;

    showRegisterPushSubscription: boolean = false;

    private _client: ReturnType<typeof createRecordsClient>;

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
        this._registerSubs();

        await this._checkPushSubscription();
    }

    private async _checkPushSubscription() {
        if (!this.status.metadata.hasPushSubscription) {
            console.log('Never registered push subscription');
            this.onClose();
            return;
        }
        const pushManager = await getPushManager();

        if (!pushManager) {
            console.warn("Push notifications aren't supported on this device");
            this.onClose();
            return;
        }

        let sub = await pushManager.getSubscription();

        if (sub) {
            const id = uuidv5(sub.endpoint, SUBSCRIPTION_ID_NAMESPACE);
            if (this.status.metadata.pushSubscriptionIds.includes(id)) {
                // Subscription is already registered
                console.log('Already registered push subscription');
                this.onClose();
                return;
            }

            // Subscription was already granted, but we don't have it in the metadata.
            // We can automatically re-register it
            console.log('Re-registering push subscription');
            const result = await this._client.registerPushSubscription(
                {
                    pushSubscription: sub.toJSON(),
                },
                {
                    endpoint: this.status.apiEndpoint,
                    headers: this.status.authenticationHeaders,
                }
            );

            this.onClose();
            return;
        } else {
            // ask for permission
            this.showRegisterPushSubscription = true;
        }
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    onClose() {
        this.$emit('close');
    }

    async addDevice() {
        try {
            this.processing = true;

            const pushManager = await getPushManager();

            if (!pushManager) {
                this.errors = [
                    {
                        for: 'pushSubscription',
                        errorCode: 'not_supported',
                        errorMessage:
                            "Push notifications aren't supported on this device",
                    },
                ];
                console.warn(
                    "Push notifications aren't supported on this device"
                );
                return;
            }

            const permission = await Notification.requestPermission();

            if (permission === 'denied' || permission === 'default') {
                this.errors = [
                    {
                        for: 'pushSubscription',
                        errorCode: 'permission_denied',
                        errorMessage:
                            'The user denied permission to send notifications',
                    },
                ];
                console.warn(
                    'The user denied permission to send notifications'
                );
                return;
            }

            let sub = await pushManager.getSubscription();

            if (!sub) {
                const keyResult =
                    await this._client.getNotificationsApplicationServerKey(
                        undefined,
                        {
                            endpoint: this.status.apiEndpoint,
                            headers: this.status.authenticationHeaders,
                        }
                    );

                if (keyResult.success === false) {
                    return;
                }

                sub = await pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: keyResult.key,
                });
            }

            if (sub) {
                const result = await this._client.registerPushSubscription(
                    {
                        pushSubscription: sub.toJSON(),
                    },
                    {
                        endpoint: this.status.apiEndpoint,
                        headers: this.status.authenticationHeaders,
                    }
                );

                if (result.success === true) {
                    this.onClose();
                } else {
                    this.errors = getFormErrors(result);
                }
            } else {
                this.onClose();
            }
        } finally {
            this.processing = false;
        }
    }

    private _registerSubs() {
        if (this._sub) {
            this._sub.unsubscribe();
        }

        this._sub = new Subscription();
        this._client = createRecordsClient(this.endpoint);
    }
}
