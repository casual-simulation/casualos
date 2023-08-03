import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import AuthSubscription from '../AuthSubscription/AuthSubscription';

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

    created() {}
}
