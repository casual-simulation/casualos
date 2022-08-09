import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';

document.title = location.hostname;

@Component({
    components: {
        'svg-icon': SvgIcon,
    },
})
export default class AuthApp extends Vue {
    showLogout: boolean;

    get title() {
        return location.hostname;
    }

    created() {
        this.showLogout = false;
        authManager.loginState.subscribe((state) => {
            this.showLogout = authManager.isLoggedIn();
        });
    }

    async logout() {
        await authManager.logout();
        this.$router.push({ name: 'login' });
    }
}
