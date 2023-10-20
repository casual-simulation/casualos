import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import { Bot, toast } from '@casual-simulation/aux-common';
import { Subscription } from 'rxjs';
import { appManager } from '../../../shared/AppManager';

@Component({
    components: {},
})
export default class AuthUI extends Vue {
    private _sub: Subscription;

    showNotAuthorized: boolean = false;

    private _simId: string = null;
    private _origin: string = null;

    constructor() {
        super();
    }

    created() {
        this.showNotAuthorized = false;
        this._sub = new Subscription();

        this._sub.add(
            appManager.authCoordinator.onMissingPermission.subscribe((e) => {
                this.showNotAuthorized = true;
                this._simId = e.simulationId;
                this._origin = e.origin;
            })
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    closeNotAuthorized() {
        this.showNotAuthorized = false;
        this._simId = null;
        this._origin = null;
    }

    async changeLogin() {
        if (this._simId && this._origin) {
            const simId = this._simId;
            const origin = this._origin;
            this.closeNotAuthorized();
            await appManager.authCoordinator.changeLogin(simId, origin);
        }
    }

    async newInst() {
        location.href = location.origin;
    }
}
