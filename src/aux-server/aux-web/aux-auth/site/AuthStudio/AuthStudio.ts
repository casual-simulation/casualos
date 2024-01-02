import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import AuthSubscription from '../AuthSubscription/AuthSubscription';
import {
    ListedStudioMember,
    StudioAssignmentRole,
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

    get addressFieldClass() {
        return this.addMemberErrorCode ? 'md-invalid' : '';
    }

    @Watch('studioId')
    studioIdChanged() {
        this._loadMembers();
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

        this._loadMembers();
    }

    private async _loadMembers() {
        try {
            this.loadingMembers = true;
            this.members = await authManager.listStudioMembers(this.studioId);

            const userId = authManager.userId;
            const user = this.members.find((m) => m.userId === userId);
            this.isAdmin = user?.role === 'admin';
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
