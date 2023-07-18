import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';

document.title = location.hostname;

@Component({
    components: {
        'svg-icon': SvgIcon,
    },
})
export default class AuthApp extends Vue {
    showLogout: boolean = false;
    showRecords: boolean = false;

    loadingRecords: boolean = false;
    records: any[] = [];

    get title() {
        return location.hostname;
    }

    onExpandRecords() {
        if (!this.showRecords) {
            this.loadRecords();
        }
    }

    created() {
        this.showLogout = false;
        this.showRecords = false;
        this.loadingRecords = false;
        this.records = [];
        authManager.loginState.subscribe((state) => {
            this.showLogout = authManager.isLoggedIn();
        });
    }

    async logout() {
        await authManager.logout();
        this.$router.push({ name: 'login' });
    }

    async loadRecords() {
        console.log('[AuthApp] Loading records...');
        this.loadingRecords = true;
        try {
            const records = (await authManager.listRecords()) ?? [];
            this.records = records.map((r) => ({
                name: r.name,
                label: r.name,
                ownerId: r.ownerId,
            }));
        } finally {
            this.loadingRecords = false;
        }
    }
}
