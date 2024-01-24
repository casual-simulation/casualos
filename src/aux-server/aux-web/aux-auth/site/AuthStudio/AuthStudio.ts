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
} from '@casual-simulation/aux-records';

@Component({
    components: {
        'svg-icon': SvgIcon,
        'auth-subscription': AuthSubscription,
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

    displayName: string = null;
    comId: string = null;
    ownerStudioComId: string = null;
    logoUrl: string = null;
    comIdFeatures: StudioComIdFeaturesConfiguration = {
        allowed: false,
    };
    allowAnyoneToCreateStudios: boolean = false;
    ab1BootstrapUrl: string = null;
    isLoadingInfo: boolean = false;

    errors: FormError[] = [];

    get addressFieldClass() {
        return this.addMemberErrorCode ? 'md-invalid' : '';
    }

    get displayNameFieldClass() {
        return this.errors.find((e) => e.for === 'displayName');
    }

    get logoUrlFieldClass() {
        return this.errors.find((e) => e.for === 'logoUrl');
    }

    get comIdFieldClass() {
        return this.errors.find((e) => e.for === 'comId');
    }

    get allowComId() {
        return this.comIdFeatures?.allowed;
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

        this._loadPageInfo();
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
                this.displayName = result.studio.displayName;
                this.logoUrl = result.studio.logoUrl;
                this.comId = result.studio.comId;
                this.ownerStudioComId = result.studio.ownerStudioComId;
                this.comIdFeatures = result.studio.comIdFeatures;
                this.allowAnyoneToCreateStudios =
                    !!result.studio.comIdConfig?.allowAnyoneToCreateStudios;
                this.ab1BootstrapUrl =
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
}
