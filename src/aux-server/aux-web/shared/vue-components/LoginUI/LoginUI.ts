import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import { AuthHelperInterface } from '@casual-simulation/aux-vm';
import LoginEndpointUI from '../LoginEndpointUI/LoginEndpointUI';

@Component({
    components: {
        'login-endpoint': LoginEndpointUI,
    },
})
export default class LoginUI extends Vue {
    private _sub: Subscription;
    private _endpointSubs: Map<AuthHelperInterface, Subscription>;

    endpoints: string[];

    created() {
        this._sub = new Subscription();
        this._endpointSubs = new Map();
        this.endpoints = [];

        this._sub.add(
            appManager.authCoordinator.onAuthEndpointDiscovered.subscribe(
                ({ endpoint, helper }) => {
                    this._addEndpoint(endpoint, helper);
                }
            )
        );
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    private _addEndpoint(endpoint: string, helper: AuthHelperInterface) {
        const sub = new Subscription();
        this._endpointSubs.set(helper, sub);

        sub.add(
            helper.loginUIStatus.subscribe((status) => {
                this.endpoints = [...this.endpoints, endpoint];
            })
        );

        this._sub.add(sub);
    }
}
