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

    constructor() {
        super();
    }

    created() {
        this.showNotAuthorized = false;
        this._sub = new Subscription();

        this._sub.add(
            appManager.authCoordinator.onMissingPermission.subscribe((e) => {
                this.showNotAuthorized = true;
            })
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }
}
