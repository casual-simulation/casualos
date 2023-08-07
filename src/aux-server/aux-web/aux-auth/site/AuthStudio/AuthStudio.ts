import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import AuthSubscription from '../AuthSubscription/AuthSubscription';
import { ListedStudioMember } from '@casual-simulation/aux-records';

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

    members: ListedStudioMember[] = [];
    loadingMembers: boolean = false;

    created() {}

    mounted() {
        this.loadingMembers = false;
        this.members = [];

        this._loadMembers();
    }

    private async _loadMembers() {
        try {
            this.loadingMembers = true;
            this.members = await authManager.listStudioMembers(this.studioId);
        } finally {
            this.loadingMembers = false;
        }
    }

    revokeMembership(member: ListedStudioMember) {}
}
