import Vue from 'vue';
import Component from 'vue-class-component';
import { EventBus, Loading } from '@casual-simulation/aux-components';
import { authManager } from '../AuthManager';

@Component({
    components: {
        loading: Loading,
    },
})
export default class AuthLoading extends Vue {
    loading: boolean = false;

    get version() {
        return authManager.version;
    }

    created() {
        this.loading = false;

        EventBus.$on('startLoading', () => {
            this.loading = true;
        });
        EventBus.$on('stopLoading', () => {
            this.loading = false;
        });
    }
}
