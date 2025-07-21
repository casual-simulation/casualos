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
import { appManager } from '../../AppManager';
import Component from 'vue-class-component';
import { Loading, SplashScreen } from '@casual-simulation/aux-components';
import type { ProgressMessage } from '@casual-simulation/aux-common';
import { tap } from 'rxjs/operators';

/**
 * The number of miliseconds that need to pass in order for the option to redirect to a static instance to appear.
 */
const LOADING_TIMEOUT_MS = 25_000; // 25 seconds

@Component({
    components: {
        loading: Loading,
        'splash-screen': SplashScreen,
    },
})
export default class LoadApp extends Vue {
    loading: boolean;
    loadingState: ProgressMessage = null;

    logoUrl: string = null;
    logoTitle: string = null;
    title: string = null;

    get version() {
        return appManager.version.latestTaggedVersion;
    }

    get showSplashScreen(): boolean {
        return !!this.logoUrl && this.loadingState && !this.loadingState.done;
    }

    get showLoadingDialog(): boolean {
        return this.loadingState && (!this.logoUrl || this.loadingState.error);
    }

    constructor() {
        super();
        this.loading = true;
    }

    created() {
        this.loading = true;
        this.loadingState = {
            type: 'progress',
            message: 'Starting...',
            progress: 0,
        };

        appManager.loadingProgress
            .pipe(
                tap((state) => {
                    if (state && state.error) {
                        this.loadingState = null;
                    } else {
                        this.loadingState = state;
                    }
                })
            )
            .subscribe();

        appManager.init().then(
            () => {
                this.loading = false;
                this.logoUrl =
                    appManager.comIdConfig?.logoUrl ??
                    appManager.config?.logoUrl ??
                    null;
                this.title = this.logoTitle =
                    appManager.comIdConfig?.displayName ??
                    appManager.comIdConfig?.comId ??
                    appManager.config?.logoTitle ??
                    null;
            },
            (err) => {
                console.error('[LoadApp] Loading errored:', err);
                this.loading = false;
            }
        );

        setTimeout(() => {
            if (this.loadingState && !this.loadingState.done) {
                this.loadingState = {
                    type: 'progress',
                    title: 'This is taking longer than normal.',
                    message: 'Please wait while we synchronize the experience.',
                    error: true,
                    progress: 0,
                };
            }
        }, LOADING_TIMEOUT_MS);

        const comId = appManager.getComIdFromUrl();
        if (comId) {
            appManager.getStoredComId(comId).then((config) => {
                console.log('has stored id', config);
                if (this.loading) {
                    this.logoUrl =
                        config?.logoUrl ?? appManager.config?.logoUrl ?? null;
                    this.title = this.logoTitle =
                        config.displayName ??
                        config.comId ??
                        appManager.config?.logoTitle ??
                        null;
                }
            });
        }
    }

    dismissLoading() {
        this.loadingState = null;

        let url = new URL(location.href);
        let prefixesToTrim = ['stable.', 'static.'];
        for (let prefix of prefixesToTrim) {
            if (url.host.startsWith(prefix)) {
                url.host = url.host.substring(prefix.length);
                break;
            }
        }

        url.host = 'static.' + url.host;
        location.href = url.href;
    }
}
