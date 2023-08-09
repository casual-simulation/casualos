import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import {
    CreateRecordRequest,
    ListedStudio,
} from '@casual-simulation/aux-records';

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
    showCreateRecord: boolean = false;
    records: any[] = [];
    studios: any[] = [];

    recordName: string = '';
    studioName: string = '';
    createRecordStudioId: string = null;

    get title() {
        return location.hostname;
    }

    onExpandRecords() {
        if (!this.showRecords) {
            this.loadRecords();
        }
    }

    async onExpandStudio(studio: any) {
        console.log('[AuthApp] Loading records for studio...');
        studio.loading = true;
        try {
            const records =
                (await authManager.listStudioRecords(studio.studioId)) ?? [];
            studio.records = records.map((r) => ({
                name: r.name,
                label: r.name,
                ownerId: r.ownerId,
            }));
        } finally {
            studio.loading = false;
        }
    }

    created() {
        this.showLogout = false;
        this.showRecords = false;
        this.showCreateStudio = false;
        this.showCreateRecord = false;
        this.loadingRecords = false;
        this.loadingStudios = false;
        this.records = [];
        this.studios = [];
        this.studioName = '';
        this.recordName = '';
        this.createRecordStudioId = null;
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

    startCreateRecord(studioId?: string) {
        this.showCreateRecord = true;
        this.recordName = '';
        this.createRecordStudioId = studioId ?? '';
    }

    async createStudio() {
        this.showCreateStudio = false;
        const studioId = await authManager.createStudio(this.studioName);
        await this.loadStudios();
    }

    async createRecord() {
        this.showCreateRecord = false;
        let request: Omit<CreateRecordRequest, 'userId'> = {
            recordName: this.recordName,
        };

        if (this.createRecordStudioId) {
            request['studioId'] = this.createRecordStudioId;
        } else {
            request['ownerId'] = authManager.userId;
        }

        await authManager.createRecord(request);

        if (this.createRecordStudioId) {
            const studio = this.studios.find(
                (s) => s.studioId === this.createRecordStudioId
            );
            if (studio) {
                await this.onExpandStudio(studio);
            }
        } else {
            await this.loadRecords();
        }
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
                open:
                    this.$route.name === 'studio' &&
                    this.$route.params.studioId === s.studioId,
            }));

            for (let s of this.studios) {
                if (s.open) {
                    this.onExpandStudio(s);
                }
            }
        } finally {
            this.loadingStudios = false;
        }
    }
}
