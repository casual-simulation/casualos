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

const comId = authManager.getComIdFromUrl();
document.title = comId ?? location.hostname;

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
    userId: string = '';
    createRecordStudioId: string = null;

    allowCreateStudio: boolean = false;
    logoUrl: string = null;
    displayName: string = null;
    comId: string = null;

    get title() {
        return comId ?? location.hostname;
    }

    get hostname() {
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
        this.userId = '';
        this.createRecordStudioId = null;
        this.logoUrl = null;
        this.displayName = null;
        this.allowCreateStudio = authManager.studiosSupported;
        authManager.loginState.subscribe((state) => {
            this.userId = authManager.userId;
            this.showLogout = authManager.isLoggedIn();

            if (authManager.isLoggedIn()) {
                this.loadStudios();
            }
        });

        this.comId = authManager.getComIdFromUrl();
        if (this.comId) {
            authManager.getComIdWebConfig(this.comId).then((config) => {
                if (config.success === true) {
                    this.logoUrl = config.logoUrl;
                    this.displayName = config.displayName ?? this.comId;
                    document.title = this.displayName;
                }
            });
        }
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
        const comId = authManager.getComIdFromUrl();
        const studioId = await authManager.createStudio(this.studioName, comId);
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
            const comId = authManager.getComIdFromUrl();
            const studios = (await authManager.listStudios(comId)) ?? [];
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
