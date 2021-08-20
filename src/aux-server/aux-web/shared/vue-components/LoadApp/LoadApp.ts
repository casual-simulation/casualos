import Vue from 'vue';
import { appManager } from '../../AppManager';
import Component from 'vue-class-component';
import { Loading } from '@casual-simulation/aux-components';
import { ProgressMessage } from '@casual-simulation/causal-trees';
import { switchMap, tap } from 'rxjs/operators';

@Component({
    components: {
        loading: Loading,
    },
})
export default class LoadApp extends Vue {
    loading: boolean;
    loadingState: ProgressMessage = null;

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
            },
            (err) => {
                console.error('[LoadApp] Loading errored:', err);
                this.loading = false;
            }
        );
    }

    dismissLoading() {
        this.loadingState = null;
    }
}
