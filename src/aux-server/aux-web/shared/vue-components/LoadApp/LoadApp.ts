import Vue from 'vue';
import { appManager } from '../../AppManager';
import Component from 'vue-class-component';
import { Loading } from '@casual-simulation/aux-components';
import type { ProgressMessage } from '@casual-simulation/aux-common';
import { switchMap, tap } from 'rxjs/operators';

/**
 * The number of miliseconds that need to pass in order for the option to redirect to a static instance to appear.
 */
const LOADING_TIMEOUT_MS = 25_000; // 25 seconds

@Component({
    components: {
        loading: Loading,
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
                this.logoUrl = appManager.comIdConfig?.logoUrl ?? null;
                this.title = this.logoTitle =
                    appManager.comIdConfig?.displayName ??
                    appManager.comIdConfig?.comId ??
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
                    this.logoUrl = config?.logoUrl ?? null;
                    this.title = this.logoTitle =
                        config.displayName ?? config.comId ?? null;
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
