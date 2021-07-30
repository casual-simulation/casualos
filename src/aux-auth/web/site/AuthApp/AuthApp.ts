import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide } from 'vue-property-decorator';
import { authManager } from '../AuthManager';

@Component({
    components: {},
})
export default class AuthApp extends Vue {
    showLogout: boolean;

    created() {
        this.showLogout = false;
        authManager.loginState.subscribe((state) => {
            this.showLogout = state;
        });
    }

    async logout() {
        await authManager.logout();
        this.$router.push({ name: 'login' });
    }
}
