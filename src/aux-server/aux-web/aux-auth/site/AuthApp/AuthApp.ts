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

    records: any[] = [];
    studios: any[] = [];

    showEnterStudioNameError: boolean = false;
    showCreateStudioError: boolean = false;
    showEnterRecordNameError: boolean = false;
    showInvalidRecordNameError: boolean = false;

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

    get studioNameFieldClass() {
        return this.showEnterStudioNameError || this.showCreateStudioError
            ? 'md-invalid'
            : '';
    }

    get recordNameFieldClass() {
        return this.showEnterRecordNameError || this.showInvalidRecordNameError
            ? 'md-invalid'
            : '';
    }

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
        this.showEnterStudioNameError = false;
        this.showCreateStudioError = false;
    }

    startCreateRecord(studioId?: string) {
        this.showCreateRecord = true;
        this.recordName = '';
        this.createRecordStudioId = studioId ?? '';
        this.showEnterRecordNameError = false;
        this.showInvalidRecordNameError = false;
    }

    async createStudio() {
        try {
            this.showEnterStudioNameError = false;
            this.showCreateStudioError = false;
            this.errorMessage = '';

            if (!this.studioName) {
                this.showEnterStudioNameError = true;
                return;
            }

            const comId = authManager.getComIdFromUrl();
            const response = await authManager.client.createStudio({
                displayName: this.studioName,
                ownerStudioComId: comId,
            });

            if (response.success == false) {
                this.errorMessage = response.errorMessage;
                if (response.errorCode === 'invalid_key') {
                    this.showCreateStudioError = true;
                }
                return;
            }

            this.showCreateStudio = false;
            await this.loadStudios();
        } catch (error) {
            console.error('Studio creation failed:', error);
            this.errorMessage = error.message;
            this.showCreateStudioError = true;
        }
    }

    async createRecord() {
        try {
            this.showEnterRecordNameError = false;
            this.showInvalidRecordNameError = false;
            this.errorMessage = '';

            if (!this.recordName) {
                this.showEnterRecordNameError = true;
                return;
            }

            let request: Omit<CreateRecordRequest, 'userId'> = {
                recordName: this.recordName,
                ...(this.createRecordStudioId
                    ? { studioId: this.createRecordStudioId }
                    : { ownerId: authManager.userId }),
            };

            if (this.createRecordStudioId) {
                request['studioId'] = this.createRecordStudioId;
            } else {
                request['ownerId'] = authManager.userId;
            }

            const response = await authManager.client.createRecord(request);

            if (response.success == false) {
                this.errorMessage = response.errorMessage;
                if (response.errorCode === 'invalid_key') {
                    this.showInvalidRecordNameError = true;
                } else if (response.errorCode === 'record_already_exists') {
                    this.errorMessage = 'Record name already exists';
                    this.showInvalidRecordNameError = true;
                }
                return;
            }

            this.showCreateRecord = false;
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
            this.errorMessage = error.message;
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
