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
import { OAUTH_LOGIN_CHANNEL_NAME } from '../../shared/AuthManager';

@Component({
    components: {},
})
export default class OAuthRedirect extends Vue {
    errorMessage: string = null;

    async mounted() {
        this.errorMessage = null;
        const channel = new BroadcastChannel(OAUTH_LOGIN_CHANNEL_NAME);

        const url = new URL(window.location.href);
        let params: any = {};
        for (let [key, value] of url.searchParams.entries()) {
            params[key] = value;
        }

        if (params.code && params.state) {
            const result = await authManager.processAuthCode(params);

            if (result.success === true) {
                console.log('[OAuthRedirect] Login successful');
                channel.postMessage('login');

                setTimeout(() => {
                    window.close();
                }, 0);
            } else {
                console.error('[OAuthRedirect] Login failed', result);
                if (
                    result.errorCode === 'server_error' ||
                    result.errorCode === 'invalid_request'
                ) {
                    this.errorMessage = `${result.errorMessage} If the problem persists, please contact support.`;
                } else if (result.errorCode === 'not_supported') {
                    this.errorMessage = result.errorMessage;
                } else {
                    this.errorMessage = result.errorMessage;
                }
            }
        } else if (params.error) {
            // TODO: handle errors
        }
    }
}
