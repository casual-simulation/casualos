import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide } from 'vue-property-decorator';
import { authManager } from '../../shared/AuthManager';
import CubeIcon from '@casual-simulation/aux-components/icons/Cube.svg';

document.title = location.hostname;

@Component({
    components: {
        'cube-icon': CubeIcon,
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
            this.showLogout = state;
        });
    }

    async logout() {
        await authManager.logout();
        this.$router.push({ name: 'login' });
    }
}
