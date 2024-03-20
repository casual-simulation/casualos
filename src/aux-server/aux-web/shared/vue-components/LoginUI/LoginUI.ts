import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import { AuthHelperInterface, LoginUIStatus } from '@casual-simulation/aux-vm';
import LoginEndpointUI from '../LoginEndpointUI/LoginEndpointUI';

@Component({
    components: {
        'login-endpoint': LoginEndpointUI,
    },
})
export default class LoginUI extends Vue {
    private _sub: Subscription;
    private _endpointSubs: Map<AuthHelperInterface, Subscription>;
    private _endpointUIs: Map<AuthHelperInterface, LoginUIStatus>;
    private _visible: boolean;

    endpoints: string[] = [];

    created() {
        this._sub = new Subscription();
        this._endpointSubs = new Map();
        this._endpointUIs = new Map();
        this.endpoints = [];

        appManager.init().then(() => {
            appManager.auth.setUseCustomUI(true);
        });

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

    onClose(endpoint: string) {
        const helper = appManager.authCoordinator.authEndpoints.get(endpoint);
        if (helper) {
            this._endpointUIs.set(helper, {
                page: false,
            });
            this._calculateVisibility();
        }
    }

    private _addEndpoint(endpoint: string, helper: AuthHelperInterface) {
        const sub = new Subscription();
        this._endpointSubs.set(helper, sub);
        this.endpoints = [...this.endpoints, endpoint];

        sub.add(
            helper.loginUIStatus.subscribe((status) => {
                this._endpointUIs.set(helper, status);
                this._calculateVisibility();
            })
        );

        this._sub.add(sub);
    }

    private _calculateVisibility() {
        const wasVisible = this._visible;
        this._visible = [...this._endpointUIs.values()].some(
            (ui) => ui.page !== false
        );

        if (wasVisible && !this._visible) {
            this.$emit('hidden');
        } else if (!wasVisible && this._visible) {
            this.$emit('visible');
        }
    }
}
