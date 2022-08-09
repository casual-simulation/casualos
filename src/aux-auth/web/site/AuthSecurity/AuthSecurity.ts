import { AppMetadata, UserMetadata } from '../../../shared/AuthMetadata';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { Subscription } from 'rxjs';
import { debounce, sortBy } from 'lodash';
import { tap } from 'rxjs/operators';
import type { ListedSession } from '@casual-simulation/aux-records/AuthController';
import { DateTime } from 'luxon';
import SessionLocation from '../SessionLocation/SessionLocation';
import RelativeTime from '../RelativeTime/RelativeTime';

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

    showConfirmRevokeAllSessions: boolean = false;

    created() {
        this.sessions = [];
        this.loading = false;
        this.showConfirmRevokeAllSessions = false;
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
                const result = await authManager.listSessions(expireTime);

                for (let session of result) {
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
        } catch (err) {
            console.error('[AuthSecurity] Unable to load sessions:', err);
            this.sessions = [];
        } finally {
            this.loading = false;
        }
    }
}
