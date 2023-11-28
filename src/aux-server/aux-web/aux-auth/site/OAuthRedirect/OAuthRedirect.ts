import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { OAUTH_LOGIN_CHANNEL_NAME } from '../../shared/AuthManager';

@Component({
    components: {},
})
export default class OAuthRedirect extends Vue {
    async mounted() {
        const channel = new BroadcastChannel(OAUTH_LOGIN_CHANNEL_NAME);

        const url = new URL(window.location.href);
        let params: any = {};
        for (let [key, value] of url.searchParams.entries()) {
            params[key] = value;
        }

        if (params.code && params.state) {
            const result = await authManager.processAuthCode(params);

            if (result.success === true) {
                channel.postMessage('login');
            }

            // TODO: handle errors
            setTimeout(() => {
                window.close();
            }, 0);
        } else if (params.error) {
            // TODO: handle errors
        }
    }
}
