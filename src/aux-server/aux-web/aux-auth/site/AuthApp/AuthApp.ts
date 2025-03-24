import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import type { CreateRecordRequest } from '@casual-simulation/aux-records';
import { ListedStudio } from '@casual-simulation/aux-records';
import { distinctUntilChanged } from 'rxjs';

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
    showErrorDialog: boolean = false;

    records: any[] = [];
    studios: any[] = [];

    errorMessage: string = '';
    recordName: string = '';
    studioName: string = '';
    userId: string = '';
    createRecordStudioId: string = null;

    allowCreateStudio: boolean = false;
    logoUrl: string = null;
    displayName: string = null;
    comId: string = null;
    usePrivoLogin: boolean = false;

    get title() {
        return comId ?? location.hostname;
    }

    get hostname() {
        return location.hostname;
    }

    get showSidebar() {
        return this.showLogout && this.$route.name !== 'webauthn-register';
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
            const result = await authManager.client.listRecords({
                studioId: studio.studioId,
            });

            if (result.success === false) {
                studio.records = [];
                return;
            }

            const records = result.records ?? [];
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
        this.showErrorDialog = false;
        this.loadingRecords = false;
        this.loadingStudios = false;
        this.records = [];
        this.studios = [];
        this.studioName = '';
        this.recordName = '';
        this.errorMessage = '';
        this.userId = '';
        this.createRecordStudioId = null;
        this.logoUrl = null;
        this.displayName = null;
        this.usePrivoLogin = authManager.usePrivoLogin;
        this.allowCreateStudio = authManager.studiosSupported;
        authManager.loginState
            .pipe(distinctUntilChanged())
            .subscribe((state) => {
                this.userId = authManager.userId;
                this.showLogout = authManager.isLoggedIn();

                if (state) {
                    this.loadStudios();
                }
            });

        this.comId = authManager.getComIdFromUrl();
        if (this.comId) {
            authManager.client
                .getPlayerConfig({
                    comId: this.comId,
                })
                .then((config) => {
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
        this.errorMessage = '';
    }

    startCreateRecord(studioId?: string) {
        this.showCreateRecord = true;
        this.recordName = '';
        this.errorMessage = '';
        this.createRecordStudioId = studioId ?? '';
    }

    showError(message: string) {
        this.errorMessage = '';
        this.errorMessage = message;
    }

    async createStudio() {
        try {
            const comId = authManager.getComIdFromUrl();
            const response = await authManager.client.createStudio({
                displayName: this.studioName,
                ownerStudioComId: comId,
            });
            if (response.success == false) {
                throw new Error(response.errorMessage);
            }

            this.showCreateStudio = false;
            this.errorMessage = '';

            await this.loadStudios();
        } catch (error) {
            console.error(error);
            this.showError(error.message);
        }
    }

    async createRecord() {
        try {
            let request: Omit<CreateRecordRequest, 'userId'> = {
                recordName: this.recordName,
            };

            if (this.createRecordStudioId) {
                request['studioId'] = this.createRecordStudioId;
            } else {
                request['ownerId'] = authManager.userId;
            }

            const response = await authManager.client.createRecord(request);

            if (response.success == false) {
                throw new Error(response.errorMessage);
            }

            this.showCreateRecord = false;
            this.errorMessage = '';

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
        } catch (error) {
            console.error(error);
            this.showError(error.message);
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
            const result = await authManager.client.listRecords({});

            if (result.success === false) {
                this.records = [];
                console.error('[AuthApp] Unable to load records:', result);
                return;
            }

            const records = result.records ?? [];
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
            const result = await authManager.client.listStudios({
                comId: comId ?? undefined,
            });

            if (result.success === false) {
                this.studios = [];
                return;
            }

            const studios = result.studios;
            this.studios = studios.map((s) => ({
                ...s,
                records: [] as any[],
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
