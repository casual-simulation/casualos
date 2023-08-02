import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import { ListedStudio } from '@casual-simulation/aux-records';

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
    loadingStudios: boolean = false;
    showCreateStudio: boolean = false;
    records: any[] = [];
    studios: any[] = [];

    studioName: string = '';

    get title() {
        return location.hostname;
    }

    onExpandRecords() {
        if (!this.showRecords) {
            this.loadRecords();
        }
    }

    async onExpandStudio(studio: any) {
        studio.loading = true;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        studio.loading = false;
        studio.records = [
            {
                name: 'test',
                label: 'test',
                ownerId: 'test',
            },
            {
                name: 'other',
                label: 'other',
                ownerId: 'other',
            },
        ];
    }

    created() {
        this.showLogout = false;
        this.showRecords = false;
        this.showCreateStudio = false;
        this.loadingRecords = false;
        this.loadingStudios = false;
        this.records = [];
        this.studios = [];
        this.studioName = '';
        authManager.loginState.subscribe((state) => {
            this.showLogout = authManager.isLoggedIn();

            if (authManager.isLoggedIn()) {
                this.loadStudios();
            }
        });
    }

    startCreateStudio() {
        this.showCreateStudio = true;
        this.studioName = '';
    }

    async createStudio() {
        this.showCreateStudio = false;
        const studioId = await authManager.createStudio(this.studioName);
        await this.loadStudios();
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

    async loadStudios() {
        console.log('[AuthApp] Loading studios...');
        this.loadingStudios = true;
        try {
            const studios = (await authManager.listStudios()) ?? [];
            this.studios = studios.map((s) => ({
                ...s,
                records: [],
                loading: false,
                open: false,
            }));
        } finally {
            this.loadingStudios = false;
        }
    }
}
