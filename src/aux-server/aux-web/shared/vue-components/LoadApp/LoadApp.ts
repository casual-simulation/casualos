import Vue from 'vue';
import { appManager } from '../../AppManager';
import Component from 'vue-class-component';

@Component({})
export default class LoadApp extends Vue {
    loading: boolean;

    constructor() {
        super();
        this.loading = true;
    }

    created() {
        this.loading = true;

        appManager.init().then(() => {
            this.loading = false;
        });
    }
}
