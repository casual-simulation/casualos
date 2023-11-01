import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';

@Component({
    components: {},
})
export default class OAuthRedirect extends Vue {
    async mounted() {
        const url = new URL(window.location.href);
        let params: any = {};
        for (let [key, value] of url.searchParams.entries()) {
            params[key] = value;
        }

        if (params.code && params.state) {
            await authManager.processAuthCode(params);
        }
        // window.close();
    }
}
