import Vue from 'vue';
import { appManager } from '../../AppManager';
import Component from 'vue-class-component';
import Loading from '../Loading/Loading';
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
                tap(state => {
                    this.loadingState = state;
                })
            )
            .subscribe();

        appManager.init().then(() => {
            this.loading = false;
        });
    }
}
