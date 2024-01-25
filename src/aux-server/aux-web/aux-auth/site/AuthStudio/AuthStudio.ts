import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import AuthSubscription from '../AuthSubscription/AuthSubscription';
import {
    FormError,
    ListedStudioMember,
    StudioAssignmentRole,
    StudioComIdFeaturesConfiguration,
    UpdateStudioRequest,
    getFormErrors,
} from '@casual-simulation/aux-records';
import FieldErrors from '../../../shared/vue-components/FieldErrors/FieldErrors';

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-subscription': AuthSubscription,
        'field-errors': FieldErrors,
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

    originalAllowAnyoneToCreateStudios: boolean = false;
    allowAnyoneToCreateStudios: boolean = false;

    originalAb1BootstrapUrl: string = null;
    ab1BootstrapUrl: string = null;

    isLoadingInfo: boolean = false;
    isSavingStudio: boolean = false;

    showUpdatePlayerConfig: boolean = false;
    showUpdateComIdConfig: boolean = false;
    showUpdateStudioInfo: boolean = false;
    showRequestComId: boolean = false;

    errors: FormError[] = [];

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
        return this.errors.some((e) => e.for === 'ab1BootstrapUrl')
            ? 'md-invalid'
            : '';
    }

    get allowAnyoneToCreateStudiosFieldClass() {
        return this.errors.some((e) => e.for === 'allowAnyoneToCreateStudios')
            ? 'md-invalid'
            : '';
    }

    get allowComId() {
        return this.comIdFeatures?.allowed;
    }

    get hasStudioChange() {
        return (
            this.displayName !== this.originalDisplayName ||
            this.logoUrl !== this.originalLogoUrl ||
            this.allowAnyoneToCreateStudios !==
                this.originalAllowAnyoneToCreateStudios ||
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
                update.logoUrl = this.logoUrl;
                hasUpdate = true;
            }

            if (
                this.allowAnyoneToCreateStudios !==
                this.originalAllowAnyoneToCreateStudios
            ) {
                update.comIdConfig = {
                    allowAnyoneToCreateStudios: this.allowAnyoneToCreateStudios,
                };
                hasUpdate = true;
            }

            if (this.ab1BootstrapUrl !== this.originalAb1BootstrapUrl) {
                update.playerConfig = {
                    ab1BootstrapURL: this.ab1BootstrapUrl,
                };
                hasUpdate = true;
            }

            if (!hasUpdate) {
                this.showUpdateComIdConfig = false;
                this.showUpdatePlayerConfig = false;
                this.showUpdateStudioInfo = false;
                return;
            }
            const result = await authManager.updateStudio(update);

            this.errors = getFormErrors(result);
            if (result.success) {
                this.originalDisplayName = this.displayName;
                this.originalLogoUrl = this.logoUrl;
                this.originalAllowAnyoneToCreateStudios =
                    this.allowAnyoneToCreateStudios;
                this.originalAb1BootstrapUrl = this.ab1BootstrapUrl;

                this.showUpdateComIdConfig = false;
                this.showUpdatePlayerConfig = false;
                this.showUpdateStudioInfo = false;
            }
        } finally {
            this.isSavingStudio = false;
        }
    }

    async cancelUpdateStudio() {
        this.displayName = this.originalDisplayName;
        this.logoUrl = this.originalLogoUrl;
        this.allowAnyoneToCreateStudios =
            this.originalAllowAnyoneToCreateStudios;
        this.ab1BootstrapUrl = this.originalAb1BootstrapUrl;
        this.showUpdateComIdConfig = false;
        this.showUpdatePlayerConfig = false;
        this.showUpdateStudioInfo = false;
    }

    private async _loadPageInfo() {
        this._loadStudioInfo();
        this._loadMembers();
    }

    private async _loadStudioInfo() {
        try {
            const studioId = this.studioId;
            this.isLoadingInfo = true;
            const result = await authManager.getStudio(this.studioId);
            if (studioId === this.studioId && result.success === true) {
                this.originalDisplayName = this.displayName =
                    result.studio.displayName;
                this.originalLogoUrl = this.logoUrl = result.studio.logoUrl;
                this.requestedComId = this.comId = result.studio.comId;
                this.ownerStudioComId = result.studio.ownerStudioComId;
                this.comIdFeatures = result.studio.comIdFeatures;
                this.originalAllowAnyoneToCreateStudios =
                    this.allowAnyoneToCreateStudios =
                        !!result.studio.comIdConfig?.allowAnyoneToCreateStudios;
                this.originalAb1BootstrapUrl = this.ab1BootstrapUrl =
                    result.studio.playerConfig?.ab1BootstrapURL ?? null;
            }
        } finally {
            this.isLoadingInfo = false;
        }
    }

    private async _loadMembers() {
        try {
            const studioId = this.studioId;
            this.loadingMembers = true;
            const members = await authManager.listStudioMembers(this.studioId);
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
            const result = await authManager.addStudioMember({
                studioId: this.studioId,
                addedEmail: this.addMemberEmail,
                role: this.addMemberRole as StudioAssignmentRole,
            });

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
        const result = await authManager.removeStudioMember({
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

    requestComId() {
        this.showRequestComId = true;
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
}
