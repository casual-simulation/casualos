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
import {
    AppMetadata,
    UserMetadata,
} from '../../../../aux-backend/shared/AuthMetadata';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import type { Subscription } from 'rxjs';
import { debounce, sortBy } from 'lodash';
import { tap } from 'rxjs/operators';
import type { ListedSession } from '@casual-simulation/aux-records/AuthController';
import { DateTime } from 'luxon';
import SessionLocation from '../SessionLocation/SessionLocation';
import RelativeTime from '../RelativeTime/RelativeTime';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import type { AuthenticatorKind } from '@casual-simulation/aux-common/AAGUID';
import {
    AAGUIDInfo,
    getInfoForAAGUID,
} from '@casual-simulation/aux-common/AAGUID';
import Bowser from 'bowser';

@Component({
    components: {
        'session-location': SessionLocation,
        'relative-time': RelativeTime,
    },
})
export default class AuthSecurity extends Vue {
    private _sub: Subscription;

    sessions: ListedSession[] = [];
    loading: boolean = false;
    showAddPasskey: boolean = false;
    passkeys: Passkey[] = [];

    showConfirmRevokeAllSessions: boolean = false;

    created() {
        this.sessions = [];
        this.loading = false;
        this.showConfirmRevokeAllSessions = false;
        this.showAddPasskey =
            !authManager.usePrivoLogin && browserSupportsWebAuthn();
    }

    mounted() {
        this._sub = authManager.loginState
            .pipe(
                tap((state) => {
                    if (state) {
                        this._loadSessions();
                    }
                })
            )
            .subscribe();
    }

    beforeDestroy() {
        this._sub?.unsubscribe();
    }

    addPasskey() {
        this.$router.push({ name: 'webauthn-register' });
    }

    async revokeSession(session: ListedSession) {
        const currentSession =
            session.userId === authManager.userId &&
            session.sessionId === authManager.sessionId;
        const result = await authManager.revokeSession(
            session.userId,
            session.sessionId
        );

        if (result.success) {
            this._loadSessions();

            if (currentSession) {
                this.$router.push({ name: 'login' });
            }
        }
    }

    async deletePasskey(passkey: Passkey) {
        const result = await authManager.client.deleteUserAuthenticator({
            authenticatorId: passkey.id,
        });
        if (result.success) {
            this._loadPasskeys();
        }
    }

    requestRevokeAllSessions() {
        this.showConfirmRevokeAllSessions = true;
    }

    cancelRevokeAllSessions() {
        this.showConfirmRevokeAllSessions = false;
    }

    async revokeAllSessions() {
        const result = await authManager.revokeAllSessions();
        if (result.success) {
            this.$router.push({ name: 'login' });
        }
    }

    private async _loadSessions() {
        this.loading = true;
        const now = Date.now();
        try {
            let filteredSessions = [] as ListedSession[];
            let expireTime = null as number;
            let hasNewSessions = false;
            do {
                hasNewSessions = false;
                const result = await authManager.client.listSessions({
                    expireTimeMs: expireTime,
                });

                if (result.success === false) {
                    break;
                }

                for (let session of result.sessions) {
                    if (session.expireTimeMs > now) {
                        filteredSessions.push(session);
                        hasNewSessions = true;
                    }

                    if (!expireTime || session.expireTimeMs < expireTime) {
                        expireTime = session.expireTimeMs;
                    }
                }
            } while (hasNewSessions);

            this.sessions = sortBy(filteredSessions, (s) =>
                s.revokeTimeMs ? s.revokeTimeMs : -s.expireTimeMs
            );

            await this._loadPasskeys();
        } catch (err) {
            console.error('[AuthSecurity] Unable to load sessions:', err);
            this.sessions = [];
        } finally {
            this.loading = false;
        }
    }

    private async _loadPasskeys() {
        const result = await authManager.client.listUserAuthenticators();
        if (result.success === true) {
            this.passkeys = result.authenticators.map((auth) => {
                const info = getInfoForAAGUID(auth.aaguid);
                const parser = auth.registeringUserAgent
                    ? Bowser.getParser(auth.registeringUserAgent)
                    : null;
                let creationDescription: string;
                let userAgentDescription: string;
                if (parser) {
                    creationDescription = `Created by ${parser.getBrowserName()} on ${parser.getOSName()}`;
                    userAgentDescription = `${parser.getBrowserName()} ${parser.getBrowserVersion()} on ${parser.getOSName()} ${parser.getOSVersion()}`;
                } else {
                    creationDescription = 'Created by unknown browser';
                    userAgentDescription = 'unknown';
                }
                return {
                    id: auth.id,
                    name: info.name,
                    kind: info.kind,
                    creationDescription,
                    userAgentDescription,
                    counter: auth.counter,
                    createdAtMs: auth.createdAtMs,
                };
            });
        } else {
            this.passkeys = [];
        }
    }
}

interface Passkey {
    id: string;
    name: string;
    kind: AuthenticatorKind;
    creationDescription: string;
    userAgentDescription: string;
    counter: number;
    createdAtMs: number;
}
