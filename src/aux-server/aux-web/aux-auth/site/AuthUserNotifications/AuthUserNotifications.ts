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
import { authManager } from '../../shared/index';
import type { NotificationSubscription } from '@casual-simulation/aux-records';
import { LoadingHelper } from '../LoadingHelper';

const PAGE_SIZE = 10;

@Component({
    components: {},
})
export default class AuthUserNotifications extends Vue {
    private _subscriptionsHelper: LoadingHelper<NotificationSubscription>;

    loading: boolean = false;
    subscriptions: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: NotificationSubscription[];
    } = {
        mdCount: 0,
        mdPage: 0,
        mdData: [],
        startIndex: 0,
        endIndex: 0,
    };

    selectedSubscription: NotificationSubscription = null;
    pageSize: number = PAGE_SIZE;

    mounted() {
        this._reset();
    }

    private _reset() {
        this._subscriptionsHelper = new LoadingHelper(async (lastItem) => {
            const result =
                await authManager.client.listUserNotificationSubscriptions({});

            if (result.success === true) {
                return {
                    items: result.subscriptions,
                    totalCount: result.subscriptions.length,
                };
            } else {
                return {
                    items: [],
                    totalCount: 0,
                };
            }
        });
        this.subscriptions = {
            mdCount: 0,
            mdPage: 0,
            mdData: [],
            startIndex: 0,
            endIndex: 0,
        };
        this.loading = false;
        this.updatePagination(1, PAGE_SIZE);
    }

    onSelectSubscription(item: NotificationSubscription) {
        this.selectedSubscription = item;
    }

    async unsubscribe(item: NotificationSubscription) {
        const result = await authManager.client.unsubscribeFromNotification({
            subscriptionId: item.id,
        });
        if (result.success === true) {
            // Remove the subscription from the list
            this.subscriptions.mdData = this.subscriptions.mdData.filter(
                (s) => s.id !== item.id
            );
            this.subscriptions.mdCount = this.subscriptions.mdData.length;
            // Reload to get fresh data
            this._reset();
        } else {
            console.error('Failed to unsubscribe:', result);
            // TODO: Show error message to user
        }
    }

    async updatePagination(page: number, pageSize: number) {
        let nextPage = await this._subscriptionsHelper.loadPage(page, pageSize);
        if (nextPage) {
            this.subscriptions = nextPage;
        }
        return true;
    }
}
