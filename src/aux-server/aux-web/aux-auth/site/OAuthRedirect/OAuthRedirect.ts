import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { OAUTH_LOGIN_CHANNEL_NAME } from '../../shared/AuthManager';

@Component({
    components: {},
})
export default class OAuthRedirect extends Vue {
    errorMessage: string = null;

    async mounted() {
        this.errorMessage = null;
        const channel = new BroadcastChannel(OAUTH_LOGIN_CHANNEL_NAME);

        const url = new URL(window.location.href);
        let params: any = {};
        for (let [key, value] of url.searchParams.entries()) {
            params[key] = value;
        }

        if (params.code && params.state) {
            const result = await authManager.processAuthCode(params);

            if (result.success === true) {
                console.log('[OAuthRedirect] Login successful');
                channel.postMessage('login');

                setTimeout(() => {
                    window.close();
                }, 0);
            } else {
                console.error('[OAuthRedirect] Login failed', result);
                if (
                    result.errorCode === 'server_error' ||
                    result.errorCode === 'invalid_request'
                ) {
                    this.errorMessage = `${result.errorMessage} If the problem persists, please contact support.`;
                } else if (result.errorCode === 'not_supported') {
                    this.errorMessage = result.errorMessage;
                } else {
                    this.errorMessage = result.errorMessage;
                }
            }
        } else if (params.error) {
            // TODO: handle errors
        }
    }
}
