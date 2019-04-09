import Component from "vue-class-component";
import Vue from "vue";
import { LoadingProgress } from "@yeti-cgi/aux-common/LoadingProgress";
import { appManager } from "../../../shared/AppManager";
import { hasValue } from "@yeti-cgi/aux-common";

@Component({})
export default class Loading extends Vue {

    loadingProgress: LoadingProgress = null;

    created() {
        console.log('[Loading] created');
        appManager.loadingProgress.onChanged.addListener(this.onLoadingProgressChanged);
    }

    beforeDestroy() {
        console.log('[Loading] beforeDestroy');
        appManager.loadingProgress.onChanged.removeListener(this.onLoadingProgressChanged);
    }
    
    private onLoadingProgressChanged(progress: LoadingProgress) {
        console.log('[Loading] onLoadingProgressChanged show:', progress.show, 'progress:', progress.progress, 'status:', progress.status);
        if (hasValue(progress.error)) {
            console.error('[Loading] onLoadingProgressChanged error:', progress.error);
        }

        this.loadingProgress = progress.clone();
    }
}