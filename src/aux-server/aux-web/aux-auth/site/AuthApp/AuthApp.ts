/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import Vue from 'vue';
import Component from 'vue-class-component';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import type { CreateRecordRequest } from '@casual-simulation/aux-records';
import { distinctUntilChanged } from 'rxjs';
import type { FormError } from '@casual-simulation/aux-common';
import { getFormErrors } from '@casual-simulation/aux-common';
import FieldErrors from '../../../shared/vue-components/FieldErrors/FieldErrors';

const comId = authManager.getComIdFromUrl();
document.title = comId ?? location.hostname;

@Component({
    components: {
        'svg-icon': SvgIcon,
        'field-errors': FieldErrors,
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

    errors: FormError[] = [];

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
    processing: boolean = false;

    get studioNameFieldClass() {
        const hasError = this.errors.some((e) => e.for === 'displayName');
        return hasError ? 'md-invalid' : '';
    }

    get recordNameFieldClass() {
        const hasError = this.errors.some((e) => e.for === 'recordName');
        return hasError ? 'md-invalid' : '';
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
        this.errors = [];
        this.studioName = '';
        this.recordName = '';
        this.userId = '';
        this.createRecordStudioId = null;
        this.logoUrl = null;
        this.displayName = null;
        this.usePrivoLogin = authManager.usePrivoLogin;
        this.allowCreateStudio =
            authManager.studiosSupported &&
            (!authManager.privacyFeatures ||
                authManager.privacyFeatures.allowPublicData);
        authManager.loginState
            .pipe(distinctUntilChanged())
            .subscribe((state) => {
                this.userId = authManager.userId;
                this.showLogout = authManager.isLoggedIn();

                if (state) {
                    this.loadStudios();
                }

                // Update allowCreateStudio based on privacy features
                this.allowCreateStudio =
                    authManager.studiosSupported &&
                    (!authManager.privacyFeatures ||
                        authManager.privacyFeatures.allowPublicData);
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
    }

    startCreateRecord(studioId?: string) {
        this.showCreateRecord = true;
        this.recordName = '';
        this.createRecordStudioId = studioId ?? '';
    }

    async createStudio() {
        try {
            this.errors = [];
            this.processing = true;

            const comId = authManager.getComIdFromUrl();
            const response = await authManager.client.createStudio({
                displayName: this.studioName,
                ownerStudioComId: comId,
            });

            if (response.success == false) {
                this.errors = getFormErrors(response);
                return;
            }

            this.showCreateStudio = false;
            await this.loadStudios();
        } finally {
            this.processing = false;
        }
    }

    async createRecord() {
        try {
            this.errors = [];
            this.processing = true;

            let request: Omit<CreateRecordRequest, 'userId'> = {
                recordName: this.recordName,
                ...(this.createRecordStudioId
                    ? { studioId: this.createRecordStudioId }
                    : { ownerId: authManager.userId }),
            };

            const response = await authManager.client.createRecord(request);

            if (response.success == false) {
                this.errors = getFormErrors(response);
                return;
            }

            this.showCreateRecord = false;
            if (this.createRecordStudioId) {
                console.log('createRecordStudioId hit');
                const studio = this.studios.find(
                    (s) => s.studioId === this.createRecordStudioId
                );
                if (studio) {
                    await this.onExpandStudio(studio);
                }
            } else {
                await this.loadRecords();
            }
        } finally {
            this.processing = false;
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
