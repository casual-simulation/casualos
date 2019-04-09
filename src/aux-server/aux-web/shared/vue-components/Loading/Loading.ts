import Component from "vue-class-component";
import Vue from "vue";
import { LoadingProgress } from "@yeti-cgi/aux-common/LoadingProgress";
import { appManager } from "../../../shared/AppManager";

@Component({})
export default class Loading extends Vue {

    loadingProgress: LoadingProgress = null;

    created() {
        appManager.loadingProgress.onChanged.addListener(this.onLoadingProgressChanged);
    }

    beforeDestroy() {
        appManager.loadingProgress.onChanged.removeListener(this.onLoadingProgressChanged);
    }
    
    private onLoadingProgressChanged(progress: LoadingProgress) {
        console.log('[Loading] onLoadingProgressChanged:', JSON.stringify(progress));
        this.loadingProgress = progress.clone();
    }
}