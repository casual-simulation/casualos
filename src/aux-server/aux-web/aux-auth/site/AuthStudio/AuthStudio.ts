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
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import AuthSubscription from '../AuthSubscription/AuthSubscription';
import type {
    AIHumeFeaturesConfiguration,
    AllowedStudioCreators,
    ListedStudioMember,
    StudioAssignmentRole,
    StudioComIdFeaturesConfiguration,
    StudioLoomFeaturesConfiguration,
    UpdateStudioRequest,
} from '@casual-simulation/aux-records';
import { getFormErrors } from '@casual-simulation/aux-common';
import FieldErrors from '../../../shared/vue-components/FieldErrors/FieldErrors';
import type { BiosOption, FormError } from '@casual-simulation/aux-common';
import { isEqual } from 'lodash';
import type { RecordsClientInputs } from '@casual-simulation/aux-records/RecordsClient';

// TODO: Support uploading logos
// import vueBotPond from 'vue-filepond';
// import 'filepond/dist/filepond.min.css';
// const FilePond = vueBotPond();
@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-subscription': AuthSubscription,
        'field-errors': FieldErrors,
        // 'file-pond': FilePond,
    },
})
export default class AuthStudio extends Vue {
    @Prop({ required: true })
    studioId: string;

    @Prop({ required: true })
    studioName: string;

    isAdmin: boolean = false;
    members: ListedStudioMember[] = [];
    loadingMembers: boolean = false;
    showAddMember: boolean = false;
    addMemberEmail: string = '';
    addMemberRole: string = 'member';
    addingMember: boolean = false;
    addMemberErrorCode: string = null;

    originalDisplayName: string = null;
    displayName: string = null;

    // originalComId: string = null;
    comId: string = null;
    requestedComId: string = null;

    originalOwnerStudioComId: string = null;
    ownerStudioComId: string = null;

    originalLogoUrl: string = null;
    logoUrl: string = null;
    comIdFeatures: StudioComIdFeaturesConfiguration = {
        allowed: false,
    };
    loomFeatures: StudioLoomFeaturesConfiguration = {
        allowed: false,
    };
    humeFeatures: AIHumeFeaturesConfiguration = {
        allowed: false,
    };

    originalAllowedStudioCreators: AllowedStudioCreators = 'anyone';
    allowedStudioCreators: AllowedStudioCreators = 'anyone';

    originalAb1BootstrapUrl: string = null;
    ab1BootstrapUrl: string = null;

    originalArcGisApiKey: string = null;
    arcGisApiKey: string = null;

    originalAllowedBiosOptions: BiosOption[] = null;
    allowedBiosOptions: BiosOption[] = null;

    originalDefaultBiosOption: BiosOption | 0 = null;
    defaultBiosOption: BiosOption = null;

    originalAutomaticBiosOption: BiosOption | 0 = null;
    automaticBiosOption: BiosOption = null;

    originalJitsiAppName: string = null;
    jitsiAppName: string = null;

    originalWhat3WordsApiKey: string = null;
    what3WordsApiKey: string = null;

    originalLoomPublicAppId: string = null;
    loomPublicAppId: string = null;
    loomPrivateKey: string = null;

    originalHumeApiKey: string = null;
    humeApiKey: string = null;
    humeSecretKey: string = null;

    isLoadingInfo: boolean = false;
    isSavingStudio: boolean = false;

    showUpdatePlayerConfig: boolean = false;
    showUpdateComIdConfig: boolean = false;
    showUpdateStudioInfo: boolean = false;
    showRequestComId: boolean = false;
    showUpdateLoomConfig: boolean = false;
    showUpdateHumeConfig: boolean = false;

    errors: FormError[] = [];

    // TODO: Support uploading logos
    // logoFile: File = null;

    get usePrivoLogin() {
        return authManager.usePrivoLogin;
    }

    get addressFieldClass() {
        return this.addMemberErrorCode ? 'md-invalid' : '';
    }

    get displayNameFieldClass() {
        return this.errors.some((e) => e.for === 'displayName')
            ? 'md-invalid'
            : '';
    }

    get logoUrlFieldClass() {
        return this.errors.some((e) => e.for === 'logoUrl') ? 'md-invalid' : '';
    }

    get comIdFieldClass() {
        return this.errors.some((e) => e.for === 'comId') ? 'md-invalid' : '';
    }

    get ab1BootstrapUrlFieldClass() {
        return this.errors.some((e) => e.for === 'playerConfig.ab1BootstrapUrl')
            ? 'md-invalid'
            : '';
    }

    get arcGisApiKeyFieldClass() {
        return this.errors.some((e) => e.for === 'playerConfig.arcGisApiKey')
            ? 'md-invalid'
            : '';
    }

    get allowedBiosOptionsFieldClass() {
        return this.errors.some(
            (e) => e.for === 'playerConfig.allowedBiosOptions'
        )
            ? 'md-invalid'
            : '';
    }

    get defaultBiosOptionFieldClass() {
        return this.errors.some(
            (e) => e.for === 'playerConfig.defaultBiosOption'
        )
            ? 'md-invalid'
            : '';
    }

    get automaticBiosOptionFieldClass() {
        return this.errors.some(
            (e) => e.for === 'playerConfig.automaticBiosOption'
        )
            ? 'md-invalid'
            : '';
    }

    get jitsiAppNameFieldClass() {
        return this.errors.some((e) => e.for === 'playerConfig.jitsiAppName')
            ? 'md-invalid'
            : '';
    }

    get what3WordsApiKeyFieldClass() {
        return this.errors.some(
            (e) => e.for === 'playerConfig.what3WordsApiKey'
        )
            ? 'md-invalid'
            : '';
    }

    get allowedStudioCreatorsFieldClass() {
        return this.errors.some(
            (e) => e.for === 'comIdConfig.allowedStudioCreators'
        )
            ? 'md-invalid'
            : '';
    }

    get loomPublicAppIdFieldClass() {
        return this.errors.some((e) => e.for === 'loomConfig.appId')
            ? 'md-invalid'
            : '';
    }

    get loomPrivateKeyFieldClass() {
        return this.errors.some((e) => e.for === 'loomConfig.privateKey')
            ? 'md-invalid'
            : '';
    }

    get humeApiKeyFieldClass() {
        return this.errors.some((e) => e.for === 'humeConfig.apiKey')
            ? 'md-invalid'
            : '';
    }

    get humeSecretKeyFieldClass() {
        return this.errors.some((e) => e.for === 'humeConfig.secretKey')
            ? 'md-invalid'
            : '';
    }

    get allowComId() {
        return this.comIdFeatures?.allowed;
    }

    get allowLoom() {
        return this.loomFeatures?.allowed;
    }

    get allowHume() {
        return this.humeFeatures?.allowed;
    }

    get hasStudioChange() {
        return (
            this.displayName !== this.originalDisplayName ||
            this.logoUrl !== this.originalLogoUrl ||
            this.allowedStudioCreators !== this.originalAllowedStudioCreators ||
            this.ab1BootstrapUrl !== this.originalAb1BootstrapUrl
        );
    }

    @Watch('studioId')
    studioIdChanged() {
        this._loadPageInfo();
    }

    created() {}

    mounted() {
        this.loadingMembers = false;
        this.showAddMember = false;
        this.addingMember = false;
        this.isAdmin = false;
        this.addMemberEmail = '';
        this.addMemberRole = 'member';
        this.addMemberErrorCode = null;
        this.members = [];
        this.errors = [];

        this._loadPageInfo();
    }

    async saveStudio() {
        try {
            this.isSavingStudio = true;
            let hasUpdate = false;
            let update: UpdateStudioRequest['studio'] = {
                id: this.studioId,
            };

            if (this.displayName !== this.originalDisplayName) {
                update.displayName = this.displayName;
                hasUpdate = true;
            }

            if (this.logoUrl !== this.originalLogoUrl) {
                update.logoUrl = this.logoUrl || null;
                hasUpdate = true;
            }

            if (
                this.allowedStudioCreators !==
                this.originalAllowedStudioCreators
            ) {
                update.comIdConfig = {
                    allowedStudioCreators: this.allowedStudioCreators,
                };
                hasUpdate = true;
            }

            if (this.ab1BootstrapUrl !== this.originalAb1BootstrapUrl) {
                update.playerConfig = {
                    ...(update.playerConfig || {}),
                    ab1BootstrapURL: this.ab1BootstrapUrl || null,
                };
                hasUpdate = true;
            }

            if (this.arcGisApiKey !== this.originalArcGisApiKey) {
                update.playerConfig = {
                    ...(update.playerConfig || {}),
                    arcGisApiKey: this.arcGisApiKey || null,
                };
                hasUpdate = true;
            }
            let allowedBiosOptions = this.allowedBiosOptions;
            if (allowedBiosOptions?.length <= 0) {
                allowedBiosOptions = null;
            }
            if (!isEqual(allowedBiosOptions, this.originalAllowedBiosOptions)) {
                update.playerConfig = {
                    ...(update.playerConfig || {}),
                    allowedBiosOptions: allowedBiosOptions || null,
                };
                hasUpdate = true;
            }

            if (this.defaultBiosOption !== this.originalDefaultBiosOption) {
                update.playerConfig = {
                    ...(update.playerConfig || {}),
                    defaultBiosOption: this.defaultBiosOption || null,
                };
                hasUpdate = true;
            }

            if (this.automaticBiosOption !== this.originalAutomaticBiosOption) {
                update.playerConfig = {
                    ...(update.playerConfig || {}),
                    automaticBiosOption: this.automaticBiosOption || null,
                };
                hasUpdate = true;
            }

            if (this.jitsiAppName !== this.originalJitsiAppName) {
                update.playerConfig = {
                    ...(update.playerConfig || {}),
                    jitsiAppName: this.jitsiAppName || null,
                };
                hasUpdate = true;
            }

            if (this.what3WordsApiKey !== this.originalWhat3WordsApiKey) {
                update.playerConfig = {
                    ...(update.playerConfig || {}),
                    what3WordsApiKey: this.what3WordsApiKey || null,
                };
                hasUpdate = true;
            }

            if (
                this.loomPrivateKey ||
                this.loomPublicAppId !== this.originalLoomPublicAppId
            ) {
                update.loomConfig = {
                    appId: this.loomPublicAppId || null,
                    privateKey: this.loomPrivateKey || null,
                };
                hasUpdate = true;
            }

            if (
                this.humeSecretKey ||
                this.humeApiKey !== this.originalHumeApiKey
            ) {
                update.humeConfig = {
                    apiKey: this.humeApiKey || null,
                    secretKey: this.humeSecretKey || null,
                };
                hasUpdate = true;
            }

            if (!hasUpdate) {
                this.showUpdateComIdConfig = false;
                this.showUpdatePlayerConfig = false;
                this.showUpdateStudioInfo = false;
                this.showUpdateLoomConfig = false;
                this.showUpdateHumeConfig = false;
                return;
            }
            const result = await authManager.client.updateStudio(update);

            this.errors = getFormErrors(result);
            if (result.success) {
                this.originalDisplayName = this.displayName;
                this.originalLogoUrl = this.logoUrl;
                this.originalAllowedStudioCreators = this.allowedStudioCreators;
                this.originalAb1BootstrapUrl = this.ab1BootstrapUrl;
                this.originalArcGisApiKey = this.arcGisApiKey;
                if (allowedBiosOptions) {
                    this.originalAllowedBiosOptions =
                        this.allowedBiosOptions.slice();
                } else {
                    this.originalAllowedBiosOptions = this.allowedBiosOptions =
                        null;
                }
                this.originalDefaultBiosOption = this.defaultBiosOption =
                    this.defaultBiosOption || null;
                this.originalAutomaticBiosOption = this.automaticBiosOption =
                    this.automaticBiosOption || null;
                this.originalJitsiAppName = this.jitsiAppName;
                this.originalWhat3WordsApiKey = this.what3WordsApiKey;
                this.originalLoomPublicAppId = this.loomPublicAppId;
                this.loomPrivateKey = null;
                this.originalHumeApiKey = this.humeApiKey;
                this.humeSecretKey = null;

                this.showUpdateComIdConfig = false;
                this.showUpdatePlayerConfig = false;
                this.showUpdateStudioInfo = false;
                this.showUpdateLoomConfig = false;
                this.showUpdateHumeConfig = false;
            }
        } finally {
            this.isSavingStudio = false;
        }
    }

    async cancelUpdateStudio() {
        this.displayName = this.originalDisplayName;
        this.logoUrl = this.originalLogoUrl;
        this.allowedStudioCreators = this.originalAllowedStudioCreators;
        this.ab1BootstrapUrl = this.originalAb1BootstrapUrl;
        this.showUpdateComIdConfig = false;
        this.showUpdatePlayerConfig = false;
        this.showUpdateStudioInfo = false;
        this.showUpdateLoomConfig = false;
        this.showUpdateHumeConfig = false;
    }

    private async _loadPageInfo() {
        this._loadStudioInfo();
        this._loadMembers();
    }

    private async _loadStudioInfo() {
        try {
            const studioId = this.studioId;
            this.isLoadingInfo = true;
            const result = await authManager.client.getStudio({
                studioId: this.studioId,
            });
            if (studioId === this.studioId && result.success === true) {
                this.originalDisplayName = this.displayName =
                    result.studio.displayName;
                this.originalLogoUrl = this.logoUrl = result.studio.logoUrl;
                this.requestedComId = this.comId = result.studio.comId;
                this.ownerStudioComId = result.studio.ownerStudioComId;
                this.comIdFeatures = result.studio.comIdFeatures;
                this.loomFeatures = result.studio.loomFeatures;
                this.humeFeatures = result.studio.humeFeatures;
                this.originalAllowedStudioCreators =
                    this.allowedStudioCreators =
                        result.studio.comIdConfig?.allowedStudioCreators ??
                        'anyone';
                this.originalAb1BootstrapUrl = this.ab1BootstrapUrl =
                    result.studio.playerConfig?.ab1BootstrapURL ?? null;
                this.originalArcGisApiKey = this.arcGisApiKey =
                    result.studio.playerConfig?.arcGisApiKey ?? null;
                this.originalAllowedBiosOptions = this.allowedBiosOptions =
                    result.studio.playerConfig?.allowedBiosOptions ?? null;
                this.originalDefaultBiosOption = this.defaultBiosOption =
                    result.studio.playerConfig?.defaultBiosOption ?? null;
                this.originalAutomaticBiosOption = this.automaticBiosOption =
                    result.studio.playerConfig?.automaticBiosOption ?? null;
                this.originalJitsiAppName = this.jitsiAppName =
                    result.studio.playerConfig?.jitsiAppName ?? null;
                this.originalWhat3WordsApiKey = this.what3WordsApiKey =
                    result.studio.playerConfig?.what3WordsApiKey ?? null;
                this.originalLoomPublicAppId = this.loomPublicAppId =
                    result.studio.loomConfig?.appId ?? null;
                this.originalHumeApiKey = this.humeApiKey =
                    result.studio.humeConfig?.apiKey ?? null;
                this.loomPrivateKey = null;
                this.humeSecretKey = null;
            }
        } finally {
            this.isLoadingInfo = false;
        }
    }

    private async _loadMembers() {
        try {
            const studioId = this.studioId;
            this.loadingMembers = true;
            const result = await authManager.client.listStudioMembers({
                studioId: this.studioId,
            });

            if (result.success === false) {
                this.members = [];
                return;
            }

            const members = result.members ?? [];
            if (studioId === this.studioId) {
                this.members = members;
                const userId = authManager.userId;
                const user = this.members.find((m) => m.userId === userId);
                this.isAdmin = user?.role === 'admin';
            }
        } finally {
            this.loadingMembers = false;
        }
    }

    openAddMember() {
        this.showAddMember = true;
        this.addMemberEmail = '';
        this.addMemberRole = 'member';
        this.addMemberErrorCode = null;
    }

    closeAddMember() {
        this.showAddMember = false;
    }

    async addMember() {
        try {
            this.addingMember = true;
            const request: RecordsClientInputs['addStudioMember'] = {
                studioId: this.studioId,
                role: this.addMemberRole as StudioAssignmentRole,
            };
            const isEmail = this.addMemberEmail.includes('@');
            if (this.usePrivoLogin && !isEmail) {
                request.addedDisplayName = this.addMemberEmail;
            } else if (isEmail) {
                request.addedEmail = this.addMemberEmail;
            } else if (authManager.supportsSms) {
                request.addedPhoneNumber = this.addMemberEmail;
            } else {
                request.addedUserId = this.addMemberEmail;
            }

            let result = await authManager.client.addStudioMember(request);

            if (
                result.success === false &&
                result.errorCode === 'user_not_found'
            ) {
                if (!request.addedUserId) {
                    // Try adding the user by userId if we didn't already try that
                    const idResult = await authManager.client.addStudioMember({
                        studioId: this.studioId,
                        role: this.addMemberRole as StudioAssignmentRole,
                        addedUserId: this.addMemberEmail,
                    });

                    if (idResult.success === true) {
                        result = idResult;
                    }
                }
            }

            if (result.success === true) {
                this.showAddMember = false;
                this._loadMembers();
            } else {
                this.addMemberErrorCode = result.errorCode;
            }
        } finally {
            this.addingMember = false;
        }
    }

    async revokeMembership(member: ListedStudioMember) {
        const result = await authManager.client.removeStudioMember({
            studioId: this.studioId,
            removedUserId: member.userId,
        });
        if (result.success === true) {
            this._loadMembers();
        }
    }

    startRequestComId() {
        this.showRequestComId = true;
    }

    async requestComId() {
        try {
            this.isSavingStudio = true;

            const comId = this.requestedComId;
            const result = await authManager.client.requestStudioComId({
                studioId: this.studioId,
                comId,
            });
            this.errors = getFormErrors(result);
            if (result.success === true) {
                this.showRequestComId = false;
                this.comId = this.requestedComId = comId;
            }
        } finally {
            this.isSavingStudio = false;
        }
    }

    updatePlayerConfig() {
        this.showUpdatePlayerConfig = true;
    }

    updateComIdConfig() {
        this.showUpdateComIdConfig = true;
    }

    updateStudioInfo() {
        this.showUpdateStudioInfo = true;
    }

    updateLoomConfig() {
        this.showUpdateLoomConfig = true;
    }

    updateHumeConfig() {
        this.showUpdateHumeConfig = true;
    }

    // TODO: Support uploading logos
    // onLogoFileAdded(file: File) {
    //     this.logoFile = file;
    // }

    // onLogoFileRemoved(file: File) {
    //     if (this.logoFile === file) {
    //         this.logoFile = null;
    //     }
    // }
}
