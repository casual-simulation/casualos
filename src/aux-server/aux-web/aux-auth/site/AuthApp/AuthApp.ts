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
    }

    startCreateRecord(studioId?: string) {
        this.showCreateRecord = true;
        this.recordName = '';
        this.createRecordStudioId = studioId ?? '';
    }

    async createStudio() {
        this.showCreateStudio = false;
        const comId = authManager.getComIdFromUrl();
        const result = await authManager.client.createStudio({
            displayName: this.studioName,
            ownerStudioComId: comId,
        });
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

        await authManager.client.createRecord(request);

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
